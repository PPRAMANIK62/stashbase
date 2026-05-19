/**
 * Drop-zone / sidebar import route. Accepts multipart `files[]` with a
 * parallel `paths[]` array preserving the dropped folder layout, plus
 * an optional `dir` form field that scopes the import to a subfolder
 * of the active space.
 *
 * Two non-obvious behaviours worth knowing about:
 *   1. A note `<stem>.{md,html}` and its iframe bundle `<stem>_files/`
 *      land as siblings at the drop target (NOT wrapped in `<stem>/`),
 *      matching how browsers' "Save Page As Complete" produces them.
 *   2. Stem collisions are renumbered (`stem-2.md`, `stem-2_files/`)
 *      across BOTH the note and its bundle in lockstep, so the iframe
 *      can still find its assets after the import.
 */
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import {
  detectFormat,
  pathExists,
  sanitizeFilename,
  saveBytes,
} from '../files.ts';
import { errorMessage, logger } from '../log.ts';
import { getCurrentSpace } from '../space.ts';
import { maybeConvertPdf } from '../pdf.ts';
import { indexer } from '../state.ts';

const log = logger('routes/upload');

// In-memory upload buffer. Bumped beyond the original 8 MB / 50-file
// limits to accommodate "Save Page As Complete" bundles (arxiv HTML
// pulls in dozens of figures + CSS).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 64 * 1024 * 1024, files: 500 },
});

export function mount(app: express.Express): void {
  app.post('/api/upload', upload.array('files', 500), async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) return res.status(400).json({ error: 'no files' });
    // Optional `dir` form field: space-relative path of the folder to
    // drop the files into. Sanitised the same way we treat any other
    // write path so a stray `..` or absolute path can't escape the space.
    let dir = typeof req.body?.dir === 'string' ? req.body.dir.trim() : '';
    if (dir) dir = sanitizeFilename(dir).replace(/\/+$/, '');
    const prefix = dir ? dir + '/' : '';

    // Parallel `paths` array preserves the dropped folder layout —
    // see web `walkEntry`. Multer normalises a single value to a string
    // and ≥2 to an array; coerce to a string array.
    const rawPaths = req.body?.paths;
    const paths: string[] = Array.isArray(rawPaths)
      ? rawPaths.map(String)
      : typeof rawPaths === 'string' ? [rawPaths] : [];

    const finalNames = computeFinalNames(files, paths, prefix);

    const out: { file: string; error?: string }[] = [];
    const toIndex: { name: string; text: string }[] = [];
    const toConvertPdf: { abs: string; rel: string }[] = [];
    const spaceAbs = getCurrentSpace();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const name = finalNames[i];
      try {
        // Always save bytes to disk — bundle assets (PNG / CSS / WOFF
        // shipped alongside an arxiv HTML) are needed by the iframe even
        // though they're not indexable. Only indexable formats go to
        // the indexer.
        saveBytes(name, f.buffer);
        out.push({ file: name });
        if (detectFormat(name)) {
          toIndex.push({ name, text: f.buffer.toString('utf8') });
        } else if (spaceAbs && /\.pdf$/i.test(name)) {
          // PDFs run through the pymupdf / marker pipeline so the
          // user gets a readable note + image bundle they can preview
          // and that the indexer can pick up via the watcher.
          toConvertPdf.push({ abs: path.join(spaceAbs, name), rel: name });
        }
      } catch (err: unknown) {
        out.push({ file: name, error: errorMessage(err) });
      }
    }
    res.json({ files: out });
    // Background indexing — don't await; the response has already been sent.
    (async () => {
      for (const { name, text } of toIndex) {
        try {
          await indexer.upsertFile(name, text);
        } catch (err: unknown) {
          log.warn(`upload: index failed for ${name}: ${errorMessage(err)}`);
        }
      }
    })();
    for (const { abs, rel } of toConvertPdf) maybeConvertPdf(abs, rel);
  });
}

/** Compute the on-disk paths for a batch up front so notes that would
 *  clash with an existing file get a `-2` / `-3` suffix and their
 *  attached `<stem>_files/` bundle is renamed in lockstep. */
function computeFinalNames(
  files: Express.Multer.File[],
  paths: string[],
  prefix: string,
): string[] {
  // Step 1: collect top-level notes in this drop and reserve a
  // non-colliding stem for each one. "Top-level" = no folder
  // separator in the relPath (so it lives directly at the drop
  // target, alongside its `<stem>_files/` bundle if any).
  const stemRenames = new Map<string, string>(); // origStem → finalStem
  const reserved = new Set<string>();
  function relForFile(idx: number): string {
    const f = files[idx];
    return paths[idx] && paths[idx].length ? paths[idx] : f.originalname;
  }
  for (let i = 0; i < files.length; i++) {
    const rel = relForFile(i);
    if (rel.includes('/')) continue;
    const m = rel.match(/^(.+)\.(md|markdown|html|htm)$/i);
    if (!m) continue;
    const origStem = m[1];
    const ext = rel.slice(origStem.length); // includes leading dot
    let finalStem = origStem;
    let n = 2;
    while (
      pathExists(prefix + finalStem + ext)
      || pathExists(prefix + finalStem + '_files')
      || reserved.has(finalStem + ext)
    ) {
      finalStem = `${origStem}-${n}`;
      n++;
    }
    if (finalStem !== origStem) stemRenames.set(origStem, finalStem);
    reserved.add(finalStem + ext);
  }
  // Step 2: rewrite every file's path. Note files use the chosen
  // final stem; bundle files under `<origStem>_files/...` rewrite
  // their top segment to track the same renumbered stem.
  return files.map((_, i) => {
    const rel = relForFile(i);
    const segments = rel.split('/');
    if (segments.length === 1) {
      const m = rel.match(/^(.+)\.(md|markdown|html|htm)$/i);
      if (m && stemRenames.has(m[1])) {
        const ext = rel.slice(m[1].length);
        return sanitizeFilename(prefix + stemRenames.get(m[1])! + ext);
      }
      return sanitizeFilename(prefix + rel);
    }
    const top = segments[0];
    const bm = top.match(/^(.+)_files$/);
    if (bm && stemRenames.has(bm[1])) {
      segments[0] = stemRenames.get(bm[1])! + '_files';
      return sanitizeFilename(prefix + segments.join('/'));
    }
    return sanitizeFilename(prefix + rel);
  });
}
