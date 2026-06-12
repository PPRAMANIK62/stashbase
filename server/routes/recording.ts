/**
 * Screen-recording ingest route. Note-first:
 *
 *   1. saves the webm into the note's asset bundle
 *      (`recording-<ts>_files/recording.webm`) — persisted before any
 *      processing, so a failed analysis never loses the recording,
 *   2. runs Gemini video understanding in the background,
 *   3. writes a VISIBLE `recording-<ts>.md` note with the structured
 *      content + an inline <video> player for the saved webm.
 *
 * The note is the product; the video rides along as its attachment
 * (`<stem>_files/` bundles are hidden in the tree and follow the note
 * on rename/delete). Progress surfaces through the same "Converting…"
 * banner as the file converters (`runBackgroundConversion`, keyed to
 * the note path).
 */
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { runBackgroundConversion } from '../conversion.ts';
import { sanitizeFilename, saveBytes, saveText } from '../files.ts';
import { analyzeVideoWithGemini, geminiConfigured } from '../gemini-video.ts';
import { errorMessage, logger } from '../log.ts';
import { getCurrentSpace, runWithWindowId, toKbRel, WINDOW_ID_HEADER } from '../space.ts';
import { getGeminiKey, setGeminiKey } from '../app-config.ts';
import { indexer } from '../state.ts';

const log = logger('routes/recording');

// Recordings land in the note's asset bundle; allow comfortably larger
// than the 64 MB upload cap — a long recording is legitimately big.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 512 * 1024 * 1024, files: 1 },
});

export function mount(app: express.Express): void {
  app.post('/api/recording', upload.single('file'), async (req, res) => {
    // Re-bind the window context dropped by multer's body parsing (same
    // reason as the upload route) so space-scoped lookups resolve.
    await runWithWindowId(req.header(WINDOW_ID_HEADER), () => handleRecording(req, res));
  });

  // Gemini key management — GET (configured?), PUT (set), DELETE (remove).
  app.get('/api/gemini/key', (_req, res) => {
    res.json({ hasKey: geminiConfigured() });
  });

  app.put('/api/gemini/key', (req, res) => {
    const key = typeof req.body?.geminiKey === 'string' ? req.body.geminiKey.trim() : '';
    if (!key) { res.status(400).json({ error: 'geminiKey required' }); return; }
    setGeminiKey(key);
    res.json({ hasKey: true });
  });

  app.delete('/api/gemini/key', (_req, res) => {
    setGeminiKey(undefined);
    res.json({ hasKey: false });
  });
}

function recordingStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function handleRecording(req: express.Request, res: express.Response): void {
  const file = req.file;
  if (!file) { res.status(400).json({ error: 'no file' }); return; }

  // Recording is Gemini-only by design — no local frame-OCR fallback.
  // (2026-06 decision: the feature's promise is a high-quality structured
  // note; a low-quality offline fallback dilutes it. The renderer
  // pre-checks the key before recording starts; this is the backstop.)
  if (!geminiConfigured()) {
    res.status(412).json({
      error: 'Screen recording needs a Gemini API key — add one in Settings → Capture.',
      code: 'GEMINI_KEY_REQUIRED',
    });
    return;
  }

  const space = getCurrentSpace();
  if (!space) { res.status(412).json({ error: 'no space open', code: 'NO_SPACE' }); return; }

  let dir = typeof req.body?.dir === 'string' ? req.body.dir.trim() : '';
  if (dir) dir = sanitizeFilename(dir).replace(/\/+$/, '');
  const prefix = dir ? dir + '/' : '';
  const stamp = recordingStamp();
  const noteRel = `${prefix}recording-${stamp}.md`;
  const bundleName = `recording-${stamp}_files`;
  const videoRel = `${prefix}${bundleName}/recording.webm`;

  // Resolve the KB-relative form now, while the window context is live —
  // the background job runs after the response and we re-bind there.
  let kbRel: string;
  try {
    kbRel = toKbRel(noteRel);
  } catch {
    res.status(412).json({ error: 'no space open', code: 'NO_SPACE' });
    return;
  }

  // Persist the recording into the note's asset bundle FIRST — from here
  // on, no failure mode (Gemini error, crash, restart) loses the video.
  try {
    saveBytes(videoRel, file.buffer);
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
    return;
  }
  const videoAbs = path.join(space, videoRel);

  // Respond now; analysis runs in the background and the note appears when
  // done (the sidebar's "Converting…" banner tracks `kbRel` meanwhile).
  res.json({ ok: true, file: noteRel });

  // Relative to the note, which sits next to its bundle.
  const videoEmbed =
    `\n\n---\n\n<video controls preload="metadata" src="${bundleName}/recording.webm"></video>\n`;

  const windowId = req.header(WINDOW_ID_HEADER);
  void runBackgroundConversion(kbRel, () => runWithWindowId(windowId, async () => {
    let text: string;
    try {
      // Gemini video understanding — reads layout / reading order /
      // temporal flow that per-frame OCR can't (multi-column, dynamic).
      text = await analyzeVideoWithGemini(videoAbs, 'video/webm');
    } catch (err) {
      // Still leave a visible note — the saved video makes the recording
      // recoverable, but a silent failure would hide that it exists.
      log.warn(`recording analysis failed for ${noteRel}: ${errorMessage(err)}`);
      text = `# Recording\n\n_Could not analyze this recording: ${errorMessage(err)}_\n`;
    }
    saveText(noteRel, text + videoEmbed);
    await indexer.upsertFile(kbRel, text + videoEmbed);
    log.info(`recording note written: ${noteRel}`);
  }));
}
