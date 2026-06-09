/**
 * Video → OCR-text note conversion, driven by `python/ocr_video.py`.
 *
 * The video analogue of `image.ts`: whenever a screen recording (or a
 * dropped video) lands in a space, we spawn the frame-sampling OCR in the
 * background. It samples frames, skips near-duplicates, OCRs each, dedupes
 * the lines, and writes `.<filename>.md` alongside the video. The fs.watch
 * debounce picks it up and the indexer embeds the note — so a recording's
 * on-screen text becomes searchable. The video itself stays on disk as the
 * user-facing file.
 *
 * Like images (and unlike PDFs) there is no bundle — only the single
 * derived note, dot-prefixed for the same reason (app-maintained artifact,
 * hidden in the sidebar via `files.ts walk()`'s sibling rule, still
 * indexed). Conversion status reuses the same `state.db`-backed store
 * (`conversion-status.ts`) as PDFs/images, so the "Converting…" indicator
 * and Retry banner cover videos for free.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { isVideoFile } from './format.ts';
import { extractorSpawn } from './python-host.ts';
import { discoverNewSources, maybeConvert, type ConversionSpec } from './conversion.ts';

/** Dot-prefixed derived note path (`.<filename>.md`) for a video — same
 *  hidden-sibling layout images use. Carries the full source filename so
 *  same-stem different-extension files don't collide. */
export function derivedNotePathForVideo(videoAbsPath: string): string {
  const dir = path.dirname(videoAbsPath);
  return path.join(dir, `.${path.basename(videoAbsPath)}.md`);
}

/** Spawn the frame-OCR extractor for `videoAbsPath`, writing the markdown
 *  to `outNoteAbsPath`. Resolves on success; rejects with the stderr tail
 *  on failure. Shared by the drop-in sidecar path (writes the hidden
 *  `.<file>.md`) and the recording pipeline (writes a temp note it then
 *  promotes to a visible note). */
export function runVideoOcr(
  videoAbsPath: string,
  outNoteAbsPath: string,
  opts: { debugDir?: string } = {},
): Promise<void> {
  const extra = opts.debugDir ? ['--debug-dir', opts.debugDir] : [];
  return new Promise((resolve, reject) => {
    const { cmd, args } = extractorSpawn('video', 'ocr_video.py', [videoAbsPath, outNoteAbsPath, ...extra]);
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (b) => { stderr += String(b); });
    proc.on('error', (err) => reject(new Error(`spawn failed: ${err.message}`)));
    proc.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const tail = stderr.trim().split('\n').slice(-3).join('\n');
        reject(new Error(`ocr_video exit ${code}: ${tail || '(no stderr)'}`));
      }
    });
  });
}

/** Run the video OCR extractor for a dropped-in video, writing the hidden
 *  derived sidecar note. Fire-and-forget at the call site. */
export function convertVideo(videoAbsPath: string): Promise<{ notePath: string }> {
  const notePath = derivedNotePathForVideo(videoAbsPath);
  return runVideoOcr(videoAbsPath, notePath).then(() => ({ notePath }));
}

/** Conversion spec wiring videos into the shared `conversion.ts` plumbing. */
const VIDEO_SPEC: ConversionSpec = {
  kind: 'ocr_video',
  matches: isVideoFile,
  derivedNote: derivedNotePathForVideo,
  convert: convertVideo,
};

/** Fire-and-forget video OCR used by the upload route. Skips if the note
 *  already exists; persists in-flight → done/failed to `state.db` (shared
 *  with PDFs/images) so the UI can show status. */
export function maybeConvertVideo(videoAbsPath: string, spaceRelative: string): void {
  maybeConvert(videoAbsPath, spaceRelative, VIDEO_SPEC);
}

/** Reconcile hook: OCR any untracked video under the space (added via git
 *  checkout / external copy / `mv`), back-filling a `done` record when the
 *  sibling note already exists. */
export function discoverNewVideos(spaceAbs: string): void {
  discoverNewSources(spaceAbs, VIDEO_SPEC);
}
