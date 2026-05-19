/**
 * PDF → note-with-bundle conversion, driven by `python/pdf_extract.py`.
 *
 * Wired from the upload route: whenever a `.pdf` lands in a space we
 * spawn the extractor in the background. It writes `<stem>.html`
 * (default) and `<stem>_files/` alongside the PDF, then the fs.watch
 * debounce picks them up and the indexer embeds the new note. The
 * PDF stays on disk as a sibling — not indexed, not previewable from
 * sidebar, but kept so the user can verify against the source.
 *
 * Format / converter knobs (set on the server process, no per-space
 * config yet):
 *   - `STASHBASE_PDF_FORMAT`     html | md   (default html)
 *   - `STASHBASE_PDF_CONVERTER`  pymupdf | marker  (default pymupdf)
 *
 * `marker` needs a separate `pip install marker-pdf` inside the same
 * venv — see `python/pdf_extract.py` for why.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from './log.ts';

const log = logger('pdf');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = process.env.STASHBASE_APP_ROOT
  ? path.resolve(process.env.STASHBASE_APP_ROOT)
  : path.resolve(__dirname, '..');
const RESOURCES_ROOT = process.env.STASHBASE_RESOURCES_PATH
  ? path.resolve(process.env.STASHBASE_RESOURCES_PATH)
  : PROJECT_ROOT;

function pythonBin(): string {
  if (process.env.STASHBASE_PYTHON) return process.env.STASHBASE_PYTHON;
  for (const candidate of [
    path.join(RESOURCES_ROOT, 'python', 'runtime', 'bin', 'python'),
    path.join(RESOURCES_ROOT, 'python', '.venv', 'bin', 'python'),
    path.join(PROJECT_ROOT, 'python', '.venv', 'bin', 'python'),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return 'python3';
}

function extractorScript(): string {
  return path.join(PROJECT_ROOT, 'python', 'pdf_extract.py');
}

export interface ConvertResult {
  /** Absolute path of the written `<stem>.{md,html}`. */
  notePath: string;
  /** Absolute path of the `<stem>_files/` bundle. */
  bundleDir: string;
  /** Resolved output format — needed by the caller to pick the right
   *  re-index step. */
  format: 'md' | 'html';
}

/** Run the extractor on a single PDF. Resolves with paths on success;
 *  rejects with the extractor's stderr tail on failure. Fire-and-
 *  forget at the call site if you don't want to block — `convertPdf`
 *  itself does not throw synchronously. */
export function convertPdf(pdfAbsPath: string): Promise<ConvertResult> {
  const fmt = (process.env.STASHBASE_PDF_FORMAT === 'md' ? 'md' : 'html') as 'md' | 'html';
  const dir = path.dirname(pdfAbsPath);
  const stem = path.basename(pdfAbsPath, path.extname(pdfAbsPath));
  const notePath = path.join(dir, `${stem}.${fmt}`);
  const bundleDir = path.join(dir, `${stem}_files`);
  const converter = process.env.STASHBASE_PDF_CONVERTER === 'marker' ? 'marker' : 'pymupdf';

  return new Promise((resolve, reject) => {
    const proc = spawn(
      pythonBin(),
      [extractorScript(), pdfAbsPath, notePath, bundleDir, '--converter', converter, '--format', fmt],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stderr = '';
    proc.stderr.on('data', (b) => { stderr += String(b); });
    proc.on('error', (err) => reject(new Error(`spawn failed: ${err.message}`)));
    proc.on('exit', (code) => {
      if (code === 0) {
        resolve({ notePath, bundleDir, format: fmt });
      } else {
        const tail = stderr.trim().split('\n').slice(-3).join('\n');
        reject(new Error(`pdf_extract exit ${code}: ${tail || '(no stderr)'}`));
      }
    });
  });
}

/** Space-relative paths of PDFs currently being converted. The
 *  /api/index-status route reads this so the sidebar can render a
 *  "Converting…" indicator and auto-reload once the entry disappears
 *  (= the new note has landed on disk). */
const inFlight = new Set<string>();

export function getInFlightPdfs(): string[] {
  return Array.from(inFlight).sort();
}

/** Fire-and-forget wrapper used by the upload route. Skips silently
 *  if the target note already exists (re-drop of the same PDF). On
 *  success / failure logs at info / warn so the server console is
 *  the diagnostic surface; the UI just sees the new file appear (or
 *  not). `spaceRelative` is what we expose to clients via the
 *  in-flight set — same path shape the rest of the API uses. */
export function maybeConvertPdf(pdfAbsPath: string, spaceRelative: string): void {
  const fmt = process.env.STASHBASE_PDF_FORMAT === 'md' ? 'md' : 'html';
  const dir = path.dirname(pdfAbsPath);
  const stem = path.basename(pdfAbsPath, path.extname(pdfAbsPath));
  const existing = path.join(dir, `${stem}.${fmt}`);
  if (existsSync(existing)) {
    log.info(`skipped ${pdfAbsPath} — ${path.basename(existing)} already present`);
    return;
  }
  log.info(`converting ${pdfAbsPath} → ${path.basename(existing)} …`);
  inFlight.add(spaceRelative);
  const t0 = Date.now();
  convertPdf(pdfAbsPath).then(
    (res) => {
      log.info(
        `converted in ${Date.now() - t0}ms: ` +
          `${path.basename(res.notePath)} + ${path.basename(res.bundleDir)}/`,
      );
    },
    (err: Error) => log.warn(`conversion failed for ${pdfAbsPath}: ${err.message}`),
  ).finally(() => {
    // Keep the entry visible for at least MIN_VISIBLE_MS after the
    // conversion starts so the client's status poll has a window to
    // pick it up even for sub-second conversions. Without this, a
    // 200 ms pymupdf run can finish and clean up before the client
    // ever sees a non-empty pendingConversions response.
    const MIN_VISIBLE_MS = 800;
    const elapsed = Date.now() - t0;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    setTimeout(() => { inFlight.delete(spaceRelative); }, wait);
  });
}
