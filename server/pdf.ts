/**
 * PDF → markdown-with-bundle conversion, driven by `python/pdf_extract.py`.
 *
 * Wired from the upload route: whenever a `.pdf` lands in a space we
 * spawn the extractor in the background. It writes `.<sourceBasename>.md` and
 * `.<sourceBasename>_files/` alongside the PDF; on completion the note is pushed into the index directly and the pipeline picks
 * them up and the indexer embeds the new note. Both the derived note
 * and its bundle are dot-prefixed — they're app-maintained artifacts,
 * not user content, so they sit alongside `.stashbase/` / `.claude/`
 * in our "dot-prefix = system, no-prefix = user" convention. The PDF
 * itself stays on disk as a regular file — the user-facing copy.
 *
 * Hidden in the sidebar via `files.ts walk()`'s sibling-bound hide
 * rule (a `paper.pdf` next to `.paper.pdf.md` collapses the derived files
 * into the PDF row), but the indexer still picks them up so RAG sees
 * the structured content.
 *
 * Default `pymupdf` route uses `pymupdf4llm` for LLM-friendly markdown
 * (heading detection, table extraction, figure screenshots), falling back
 * to plain PyMuPDF text extraction when the richer layout pass fails.
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { isDerivedNoteName, matchDerivedNote, NOTE_EXTS } from './format.ts';
import { extractorSpawn } from './python-host.ts';
import { discoverNewSources, maybeConvert, type ConversionSpec } from './conversion.ts';
import type { ConversionProgress } from './conversion-status.ts';
import { logger } from './log.ts';

const log = logger('pdf');
const STDERR_TAIL_BYTES = 64 * 1024;

export interface ConvertResult {
  /** Absolute path of the written `.<sourceBasename>.md` (dot-prefixed app-
   *  derived note; hidden from the sidebar via sibling-bound rules
   *  in files.ts walk()). */
  notePath: string;
  /** Absolute path of the `.<sourceBasename>_files/` bundle (dot-prefixed for
   *  the same reason). */
  bundleDir: string;
}

/** Derive the dot-prefixed sibling paths for a given PDF — the file
 *  layout the rest of this module operates on. Returns both the
 *  markdown note we'll emit and the image bundle dir, so callers
 *  don't need to repeat the naming. */
export function derivedPathsForPdf(pdfAbsPath: string): { notePath: string; bundleDir: string } {
  const dir = path.dirname(pdfAbsPath);
  // Derived names carry the full source filename (`paper.pdf`) so a
  // `paper.pdf` and a `paper.png` don't collide on `.paper.pdf.md`.
  const base = path.basename(pdfAbsPath);
  return {
    notePath: path.join(dir, `.${base}.md`),
    bundleDir: path.join(dir, `.${base}_files`),
  };
}

function cleanupDerivedPdf(pdfAbsPath: string): void {
  const { notePath, bundleDir } = derivedPathsForPdf(pdfAbsPath);
  rmSync(notePath, { force: true });
  rmSync(bundleDir, { recursive: true, force: true });
  cleanupDerivedPdfScratch(pdfAbsPath);
}

function cleanupDerivedPdfScratch(pdfAbsPath: string): void {
  const dir = path.dirname(pdfAbsPath);
  const base = path.basename(pdfAbsPath);
  const stem = base.replace(/\.pdf$/i, '');
  const sourceNames = [base, stem].filter(Boolean).map(escapeRegExp).join('|');
  const scratchRe = new RegExp(
    `^(?:\\.{1,2}(?:${sourceNames})_files\\.(?:tmp|batch)-.*|\\.${escapeRegExp(base)}\\.md\\.tmp-.*|\\.${escapeRegExp(base)}\\.md\\.batches)$`,
    'i',
  );
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const ent of entries) {
    if (scratchRe.test(ent.name)) {
      rmSync(path.join(dir, ent.name), { recursive: ent.isDirectory(), force: true });
    }
  }
}

function escapeRegExp(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Given a POSIX-relative path to a dot-prefixed app-derived note
 *  (`.paper.pdf.md` / `.shot.png.md`), return the relative path of its
 *  parent binary source (PDF / image) when that source exists on disk —
 *  or null if the shape doesn't match or the source is gone. The source
 *  filename is encoded in the derived name, so this is a direct read +
 *  existence check (no extension probing). Used by the search routes to
 *  rewrite hits so users see the PDF / image row rather than the hidden
 *  derived note. `baseAbs` is the root the relative path resolves against
 *  (space root for /api/search, kb root for /api/kb/search). */
function originalForDerivedNote(noteRel: string, baseAbs: string): string | null {
  // The derived name encodes the full source filename, so the source is
  // read straight off it — no extension probing.
  const m = matchDerivedNote(noteRel);
  if (!m) return null;
  return existsSync(path.join(baseAbs, m.source)) ? m.source : null;
}

function originalForLegacyDerivedNote(noteRel: string, baseAbs: string): string | null {
  const norm = noteRel.replace(/\\/g, '/');
  const dir = path.posix.dirname(norm);
  const base = path.posix.basename(norm);
  const extAlt = NOTE_EXTS.join('|');
  const m = base.match(new RegExp(`^\\.(.+)\\.(${extAlt})$`, 'i'));
  if (!m) return null;
  const stem = m[1];
  // Current derived notes (`.paper.pdf.md`) are handled above. Treat
  // extension-less legacy names (`.paper.md`) as derived only when a
  // source with the same stem exists next to them; this keeps ordinary
  // user-authored hidden notes visible unless they collide with a legacy
  // converter artifact.
  if (/\.(pdf|png|jpe?g|webp)$/i.test(stem)) return null;
  for (const ext of ['pdf', 'png', 'jpg', 'jpeg', 'webp']) {
    const sourceBase = `${stem}.${ext}`;
    const source = dir === '.' ? sourceBase : `${dir}/${sourceBase}`;
    if (existsSync(path.join(baseAbs, source))) return source;
  }
  return null;
}

/** The single remap-or-drop rule every search route applies to a hit's
 *  path so a hidden derived note is never shown to the user:
 *
 *    • app-derived note (`.paper.pdf.md` / `.shot.png.md`) with a live source
 *        → the source PDF / image (the clickable, openable original);
 *    • derived note whose source is gone (orphan)
 *        → `null`, i.e. drop the hit — the bare `.md` is hidden in the
 *          sidebar and must never surface as an unopenable row;
 *    • any normal file → unchanged.
 *
 *  `rel` is relative to `baseAbs` (space root for the GUI routes, KB root
 *  for MCP). Centralised here so `/api/search`, `/api/keyword-search`,
 *  and `/api/kb/search` can't drift apart. */
export function displayPathForHit(rel: string, baseAbs: string): string | null {
  const source = originalForDerivedNote(rel, baseAbs);
  if (source) return source;
  const legacySource = originalForLegacyDerivedNote(rel, baseAbs);
  if (legacySource) return legacySource;
  if (isDerivedNoteName(rel)) return null;
  return rel;
}

/** Run the extractor on a single PDF. Resolves with paths on success;
 *  rejects with the extractor's stderr tail on failure. Fire-and-
 *  forget at the call site if you don't want to block — `convertPdf`
 *  itself does not throw synchronously. */
function convertPdf(
  pdfAbsPath: string,
  onProgress?: (progress: ConversionProgress) => void,
  signal?: AbortSignal,
): Promise<ConvertResult> {
  const { notePath, bundleDir } = derivedPathsForPdf(pdfAbsPath);

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('pdf_extract cancelled'));
      return;
    }
    const { cmd, args } = extractorSpawn('pdf', 'pdf_extract.py', [
      pdfAbsPath, notePath, bundleDir,
    ]);
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    let stderrLineBuffer = '';
    let cancelled = false;
    const onAbort = () => {
      cancelled = true;
      proc.kill('SIGTERM');
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    const handleStderrLine = (line: string) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('[pdf_extract]')) {
        const message = trimmed.replace(/^\[pdf_extract\]\s*/, '');
        const started = message.match(/^batch \d+\/\d+ pages (\d+)-\d+ started$/);
        const done = message.match(/^batch \d+\/\d+ pages \d+-(\d+) done$/);
        if (started) onProgress?.({ phase: 'extracting', currentPage: Number(started[1]) });
        if (done) onProgress?.({ phase: 'extracting', currentPage: Number(done[1]) });
        log.info(`${path.basename(pdfAbsPath)}: ${message}`);
      } else if (/^(Using RapidOCR|OCR on page\.number=)/.test(trimmed)) {
        log.debug(`${path.basename(pdfAbsPath)}: ${trimmed}`);
      }
    };
    proc.stderr.on('data', (b) => {
      const text = String(b);
      stderr = (stderr + text).slice(-STDERR_TAIL_BYTES);
      const lines = (stderrLineBuffer + text).split(/\r?\n/);
      stderrLineBuffer = lines.pop() ?? '';
      for (const line of lines) handleStderrLine(line);
    });
    proc.on('error', (err) => {
      signal?.removeEventListener('abort', onAbort);
      reject(new Error(`spawn failed: ${err.message}`));
    });
    proc.on('exit', (code) => {
      signal?.removeEventListener('abort', onAbort);
      if (stderrLineBuffer) {
        handleStderrLine(stderrLineBuffer);
        stderrLineBuffer = '';
      }
      if (cancelled) {
        reject(new Error('pdf_extract cancelled'));
        return;
      }
      if (code === 0) {
        resolve({ notePath, bundleDir });
      } else {
        const tail = stderr.trim().split('\n').slice(-3).join('\n');
        reject(new Error(`pdf_extract exit ${code}: ${tail || '(no stderr)'}`));
      }
    });
  });
}

/** Conversion spec wiring PDFs into the shared `conversion.ts` plumbing. */
const PDF_SPEC: ConversionSpec = {
  kind: 'pdf_extract',
  matches: (name) => /\.pdf$/i.test(name),
  derivedNote: (abs) => derivedPathsForPdf(abs).notePath,
  convert: convertPdf,
  cleanupDerived: cleanupDerivedPdf,
};

/** Fire-and-forget convert used by the upload route. Skips if the note
 *  already exists; persists in-flight → done/failed to `state.db` so the
 *  UI can show "Converting…" and a Retry banner even after restart. */
export function maybeConvertPdf(pdfAbsPath: string): void {
  maybeConvert(pdfAbsPath, PDF_SPEC);
}

/** Reconcile hook: convert any untracked `.pdf` under the space (dropped
 *  in via git checkout / external copy / `mv`), back-filling a `done`
 *  record when the sibling note already exists. */
export function discoverNewPdfs(spaceAbs: string): void {
  discoverNewSources(spaceAbs, PDF_SPEC);
}
