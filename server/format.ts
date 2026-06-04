/**
 * Leaf module for file-format detection.
 *
 * Lives separately from `files.ts` because `files.ts` imports from
 * `watcher.ts` (→ `state.ts`, which instantiates `MfsIndexer` at module
 * top level). The MCP bundle entry only needs `detectFormat`, so
 * isolating it here keeps `mcp/server.ts` → `indexer.mfs.ts` from
 * pulling watcher/state into the bundle and creating an init-order
 * cycle that the packaged bundle can't resolve correctly.
 */

export type FileFormat = 'md' | 'html';

/** Wider format set the renderer recognises in the file tree, including
 *  binary "viewable but not indexable" formats like PDF and images.
 *  Kept distinct from `FileFormat` so anything in the indexing pipeline
 *  (chunker, daemon upsert, scan_diff) still only sees `md` / `html` —
 *  there's no risk of routing a PDF / image into a text-only pipeline by
 *  accident. PDFs and images both get a hidden `.<stem>.md` derived note
 *  (pdf_extract / ocr_extract) that carries the actual indexed text. */
export type ViewerFormat = FileFormat | 'pdf' | 'image';

/** Recognised note extensions and how the rest of the pipeline should
 *  treat them. Adding a format = one line here + a chunker + a viewer —
 *  every note / derived-note / bundle regex elsewhere derives from this
 *  list (via `NOTE_EXTS` and the `isNoteName` / `matchNoteStem` /
 *  `matchDerivedNote` helpers), so the extension set has a single home. */
const NOTE_FORMATS: Array<{ exts: string[]; format: FileFormat }> = [
  { exts: ['md', 'markdown'], format: 'md' },
  { exts: ['html', 'htm'], format: 'html' },
];

/** Every note extension (no leading dot), e.g. `['md','markdown','html','htm']`.
 *  Single source for the alternation baked into the regexes below. */
export const NOTE_EXTS: readonly string[] = NOTE_FORMATS.flatMap((f) => f.exts);

const NOTE_EXT_ALT = NOTE_EXTS.join('|');
const NOTE_EXT_RE = new RegExp(`\\.(${NOTE_EXT_ALT})$`, 'i');
/** `<dir>/.<stem>.<noteExt>` — an app-derived hidden note (dot-prefixed). */
const DERIVED_NOTE_RE = new RegExp(`^(.*/)?\\.([^/]+)\\.(${NOTE_EXT_ALT})$`, 'i');
/** `<dir>/<stem>.<noteExt>` — a visible note, captured for bundle naming. */
const NOTE_STEM_RE = new RegExp(`^(.*/)?([^/]+)\\.(${NOTE_EXT_ALT})$`, 'i');

/** True when `name` ends in a note extension (= the indexer would pick it
 *  up). Same set as `detectFormat(name) !== null`; use this for boolean
 *  "is it a note?" checks so the extension set isn't re-spelled. */
export function isNoteName(name: string): boolean {
  return NOTE_EXT_RE.test(name);
}

/** True when a path/basename has the app-derived hidden-note shape
 *  (`.<stem>.md` etc). Used by search remap/drop and the sidebar hide
 *  rule so a hidden derived note never leaks. */
export function isDerivedNoteName(pathOrName: string): boolean {
  return DERIVED_NOTE_RE.test(pathOrName);
}

/** Split a derived-note relative path into `{ dir, stem }` (dir keeps its
 *  trailing slash, or is `''` at the root), or null if the shape doesn't
 *  match. */
export function matchDerivedNote(rel: string): { dir: string; stem: string } | null {
  const m = rel.replace(/\\/g, '/').match(DERIVED_NOTE_RE);
  return m ? { dir: m[1] ?? '', stem: m[2] } : null;
}

/** Split a (visible) note relative path into `{ dir, stem }` for deriving
 *  the `<stem>_files/` bundle name, or null if it isn't a note. */
export function matchNoteStem(rel: string): { dir: string; stem: string } | null {
  const m = rel.replace(/\\/g, '/').match(NOTE_STEM_RE);
  return m ? { dir: m[1] ?? '', stem: m[2] } : null;
}

/** Image extensions we OCR + view. Deliberately narrow for V1
 *  (png / jpg / jpeg / webp) — the OCR pipeline and viewer are tested
 *  against these; widen here when we add gif / heic / etc. */
const IMAGE_PATTERN = /\.(png|jpe?g|webp)$/i;

const VIEWER_ONLY_FORMATS: Array<{ pattern: RegExp; format: ViewerFormat }> = [
  { pattern: /\.pdf$/i, format: 'pdf' },
  { pattern: IMAGE_PATTERN, format: 'image' },
];

/** True for the image extensions the OCR pipeline handles. Used by the
 *  upload route to decide whether to spawn `ocr_extract.py`, and by the
 *  derived-note remap to probe for an image original. */
export function isImageFile(name: string): boolean {
  return IMAGE_PATTERN.test(name);
}

/** Ordered list of "binary source" extensions that own a hidden
 *  `.<stem>.md` derived note — PDFs (pdf_extract) and images
 *  (ocr_extract). The derived-note → original remap probes these in
 *  order. `.pdf` first since it's the oldest / most common case. */
export const DERIVED_SOURCE_EXTS = ['pdf', 'png', 'jpg', 'jpeg', 'webp'] as const;

const NOTE_FORMAT_RES: Array<{ re: RegExp; format: FileFormat }> = NOTE_FORMATS.map((f) => ({
  re: new RegExp(`\\.(${f.exts.join('|')})$`, 'i'),
  format: f.format,
}));

export function detectFormat(name: string): FileFormat | null {
  for (const { re, format } of NOTE_FORMAT_RES) {
    if (re.test(name)) return format;
  }
  return null;
}

/** Like `detectFormat` but also recognises viewer-only formats (PDF).
 *  Used by the sidebar / file tree which surfaces every viewable file
 *  to the user, even ones that don't go through indexing. */
export function detectViewerFormat(name: string): ViewerFormat | null {
  const note = detectFormat(name);
  if (note) return note;
  for (const { pattern, format } of VIEWER_ONLY_FORMATS) {
    if (pattern.test(name)) return format;
  }
  return null;
}
