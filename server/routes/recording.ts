/**
 * Screen-recording ingest route. Note-first:
 *
 *   1. saves the webm into the note's asset bundle
 *      (`recording-<ts>_files/recording.webm`) — persisted before any
 *      processing, so a failed analysis never loses the recording,
 *   2. writes a visible placeholder `recording-<ts>.md` note with a
 *      link to that saved webm,
 *   3. runs Gemini video understanding in the background and replaces
 *      the placeholder with structured content.
 *
 * The note is the product; the video rides along as its attachment
 * (`<stem>_files/` bundles are hidden in the tree and follow the note
 * on rename/delete). We link it rather than embedding an inline
 * <video>: MediaRecorder webm has no Duration element in its header, so
 * an in-app <video preload="metadata"> stalls at 0:00 and won't play —
 * the browser (reached via previewIframe's external-open) handles it.
 * Progress surfaces through the same "Converting…" banner as the file
 * converters (`runBackgroundConversion`, keyed to the note path).
 */
import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { runBackgroundConversion } from '../conversion.ts';
import { pathExists, sanitizeFilename } from '../files.ts';
import { analyzeVideoWithGemini, geminiConfigured } from '../gemini-video.ts';
import { errorMessage, logger } from '../log.ts';
import {
  getCurrentSpace,
  getCurrentSpaceName,
  requireSpaceExistsByName,
  runWithWindowId,
  validateSpaceRef,
  WINDOW_ID_HEADER,
} from '../space.ts';
import { getApiKey, setGeminiKey } from '../app-config.ts';
import { indexer } from '../state.ts';
import { noteTreeChanged } from '../watcher.ts';
import { sendError } from '../http.ts';
import { validateUploadPath } from './upload.ts';

const log = logger('routes/recording');

// Recordings land in the note's asset bundle; allow comfortably larger
// than the 64 MB upload cap — a long recording is legitimately big.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 512 * 1024 * 1024, files: 1 },
});

export function mount(app: express.Express): void {
  app.post('/api/recording', (req, res) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err) {
        sendRecordingUploadError(res, err);
        return;
      }
      // Re-bind the window context dropped by multer's body parsing (same
      // reason as the upload route) so space-scoped lookups resolve.
      void Promise.resolve(runWithWindowId(req.header(WINDOW_ID_HEADER), () => handleRecording(req, res)))
        .catch((error: unknown) => sendError(res, error));
    });
  });

  // Gemini key management — GET (configured?), PUT (set), DELETE (remove).
  app.get('/api/gemini/key', (_req, res) => {
    res.json({ hasKey: geminiConfigured() });
  });

  app.put('/api/gemini/key', (req, res) => {
    const key = typeof req.body?.geminiKey === 'string' ? req.body.geminiKey.trim() : '';
    if (!key) { res.status(400).json({ error: 'geminiKey required' }); return; }
    try {
      setGeminiKey(key);
      res.json({ hasKey: true });
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  app.delete('/api/gemini/key', (_req, res) => {
    try {
      setGeminiKey(undefined);
      res.json({ hasKey: false });
    } catch (err: unknown) {
      sendError(res, err);
    }
  });
}

function sendRecordingUploadError(res: express.Response, err: unknown): void {
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'recording is too large to upload'
      : err.code === 'LIMIT_FILE_COUNT'
        ? 'too many recording files in one request'
        : err.message;
    res.status(status).json({ error: message, code: err.code });
    return;
  }
  res.status(400).json({ error: errorMessage(err) });
}

function recordingStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export interface RecordingPaths {
  noteRel: string;
  bundleName: string;
  videoRel: string;
}

interface FileSignature {
  size: number;
  mtimeMs: number;
  sha256: string;
}

function fileSignature(absPath: string): FileSignature | null {
  try {
    const st = fs.statSync(absPath);
    return st.isFile()
      ? {
        size: st.size,
        mtimeMs: st.mtimeMs,
        sha256: crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex'),
      }
      : null;
  } catch {
    return null;
  }
}

export function recordingNoteUnchangedForWrite(
  spaceRoot: string,
  noteRel: string,
  startedWith: FileSignature | null,
): boolean {
  let absPath: string;
  try {
    absPath = resolveInSpace(spaceRoot, noteRel);
    assertRealPathInsideSpace(spaceRoot, absPath);
  } catch {
    return false;
  }
  const current = fileSignature(absPath);
  return startedWith != null && current != null &&
    current.size === startedWith.size &&
    current.mtimeMs === startedWith.mtimeMs &&
    current.sha256 === startedWith.sha256;
}

export function reserveRecordingPaths(
  rawDir: string,
  exists: (relPath: string) => boolean = pathExists,
  stamp: string = recordingStamp(),
): RecordingPaths {
  let dir = rawDir.trim();
  if (dir) {
    dir = sanitizeFilename(dir).replace(/\/+$/, '');
    validateUploadPath(dir);
  }
  const prefix = dir ? dir + '/' : '';
  for (let i = 0; ; i++) {
    const stem = i === 0 ? `recording-${stamp}` : `recording-${stamp}-${i + 1}`;
    const noteRel = `${prefix}${stem}.md`;
    const bundleName = `${stem}_files`;
    const videoRel = `${prefix}${bundleName}/recording.webm`;
    validateUploadPath(noteRel);
    validateUploadPath(videoRel);
    if (!exists(noteRel) && !exists(`${prefix}${bundleName}`)) {
      return { noteRel, bundleName, videoRel };
    }
  }
}

function recordingVideoLink(bundleName: string): string {
  return `\n\n---\n\n📹 [Recording video](${bundleName}/recording.webm)\n`;
}

function recordingProcessingNote(bundleName: string): string {
  return `# Recording\n\n_Processing this recording with Gemini..._\n${recordingVideoLink(bundleName)}`;
}

export function isRecordingMime(mime: string | undefined): boolean {
  return typeof mime === 'string' && /^video\//i.test(mime);
}

function resolveInSpace(spaceRoot: string, relPath: string): string {
  validateUploadPath(relPath);
  const full = path.join(spaceRoot, relPath);
  const back = path.relative(spaceRoot, full);
  if (back.startsWith('..') || path.isAbsolute(back)) throw new Error('path escapes space');
  return full;
}

function isPathInsideOrSame(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function realSpaceRoot(spaceRoot: string): string {
  return fs.realpathSync.native(spaceRoot);
}

function assertRealPathInsideSpace(spaceRoot: string, absPath: string, label = 'path'): void {
  const real = fs.realpathSync.native(absPath);
  if (!isPathInsideOrSame(realSpaceRoot(spaceRoot), real)) {
    throw new Error(`${label} escapes space through symlink`);
  }
}

function assertCreatablePathInsideSpace(spaceRoot: string, absPath: string, label = 'path'): void {
  const rootReal = realSpaceRoot(spaceRoot);
  let probe = path.resolve(path.dirname(absPath));
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  const probeRel = path.relative(spaceRoot, probe);
  if (probeRel.startsWith('..') || path.isAbsolute(probeRel)) throw new Error(`${label} escapes space`);
  const probeReal = fs.realpathSync.native(probe);
  if (!isPathInsideOrSame(rootReal, probeReal)) {
    throw new Error(`${label} escapes space through symlink`);
  }
}

function pathExistsInSpace(spaceRoot: string, relPath: string): boolean {
  try {
    const target = resolveInSpace(spaceRoot, relPath);
    if (!fs.existsSync(target)) return false;
    assertRealPathInsideSpace(spaceRoot, target);
    return true;
  } catch {
    return false;
  }
}

function writeBytesInSpace(spaceRoot: string, relPath: string, bytes: Buffer): void {
  const target = resolveInSpace(spaceRoot, relPath);
  assertCreatablePathInsideSpace(spaceRoot, target);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  assertCreatablePathInsideSpace(spaceRoot, target);
  const tmp = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tmp, bytes);
    fs.renameSync(tmp, target);
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* best-effort */ }
    throw err;
  }
}

function writeTextInSpace(spaceRoot: string, relPath: string, text: string): void {
  writeBytesInSpace(spaceRoot, relPath, Buffer.from(text, 'utf8'));
}

export function __writeBytesInSpaceForTest(spaceRoot: string, relPath: string, bytes: Buffer): void {
  writeBytesInSpace(spaceRoot, relPath, bytes);
}

function handleRecording(req: express.Request, res: express.Response): void {
  const file = req.file;
  if (!file) { res.status(400).json({ error: 'no file' }); return; }
  if (!isRecordingMime(file.mimetype)) {
    res.status(415).json({ error: 'recording file must be a video', code: 'UNSUPPORTED_RECORDING_TYPE' });
    return;
  }

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

  const explicitSpace = typeof req.body?.space === 'string' && req.body.space.trim()
    ? req.body.space.trim()
    : '';
  let spaceName = explicitSpace || getCurrentSpaceName() || '';
  if (explicitSpace) {
    const bad = validateSpaceRef(explicitSpace);
    if (bad) { res.status(400).json({ error: bad }); return; }
  }
  if (!spaceName) { res.status(412).json({ error: 'no space open', code: 'NO_SPACE' }); return; }

  let space: string;
  try {
    space = explicitSpace ? requireSpaceExistsByName(explicitSpace) : getCurrentSpace()!;
  } catch (err) {
    const code = (err as { code?: unknown })?.code;
    if (code === 'SPACE_NOT_FOUND') {
      res.status(404).json({ error: 'space not found', code: 'SPACE_NOT_FOUND' });
      return;
    }
    res.status(400).json({ error: errorMessage(err) });
    return;
  }

  let paths: RecordingPaths;
  try {
    paths = reserveRecordingPaths(
      typeof req.body?.dir === 'string' ? req.body.dir : '',
      (rel) => pathExistsInSpace(space, rel),
    );
  } catch (err) {
    res.status(400).json({ error: errorMessage(err) });
    return;
  }
  const { noteRel, bundleName, videoRel } = paths;
  const kbRel = `${spaceName}/${noteRel}`;

  // Persist the recording into the note's asset bundle FIRST — from here
  // on, no failure mode (Gemini error, crash, restart) loses the video.
  // Then create a visible placeholder note immediately so the bundle is
  // hidden as a proper note attachment and a crash still leaves an
  // obvious recoverable recording in the tree.
  try {
    writeBytesInSpace(space, videoRel, file.buffer);
    writeTextInSpace(space, noteRel, recordingProcessingNote(bundleName));
    noteTreeChanged();
  } catch (err) {
    try { fs.rmSync(path.dirname(path.join(space, videoRel)), { recursive: true, force: true }); } catch { /* best-effort */ }
    res.status(500).json({ error: errorMessage(err) });
    return;
  }
  const videoAbs = path.join(space, videoRel);
  const noteStartedWith = fileSignature(path.join(space, noteRel));

  // Respond now; analysis runs in the background and the note appears when
  // done (the sidebar's "Converting…" banner tracks `kbRel` meanwhile).
  res.json({ ok: true, file: noteRel });

  // Relative to the note, which sits next to its bundle. A plain link,
  // not an inline <video> — see the header comment (MediaRecorder webm
  // lacks header duration; the browser plays it, the in-app player can't).
  const videoEmbed = recordingVideoLink(bundleName);

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
    if (!pathExistsInSpace(space, noteRel)) {
      log.info(`recording note no longer exists, skipping stale write: ${noteRel}`);
      return;
    }
    if (!recordingNoteUnchangedForWrite(space, noteRel, noteStartedWith)) {
      log.info(`recording note changed before analysis completed, skipping stale write: ${noteRel}`);
      return;
    }
    writeTextInSpace(space, noteRel, text + videoEmbed);
    noteTreeChanged();
    if (getApiKey()) {
      try {
        await indexer.upsertFile(kbRel, text + videoEmbed);
      } catch (err) {
        log.warn(`recording index failed for ${noteRel}: ${errorMessage(err)}`);
      }
    } else {
      log.info(`recording: skipped indexing ${noteRel} because no OpenAI key is configured`);
    }
    log.info(`recording note written: ${noteRel}`);
  }));
}
