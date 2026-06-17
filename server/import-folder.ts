import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ensureSpaceMetadata,
  validateSpaceName,
  pruneStashbasePerMachineState,
  STASHBASE_PER_MACHINE_ENTRIES,
} from './space.ts';
import { copyDirectoryDereferenced } from './fs-move.ts';
import { pathHasCloudPlaceholder } from './indexable.ts';

export type ImportFolderMode = 'copy' | 'move';

export interface FolderImportPreview {
  source: string;
  name: string;
  destination: string;
  exists: boolean;
  entryCount: number;
  totalBytes: number;
  requiresConfirmation: boolean;
  requiresLargeImportConfirmation: boolean;
  largeImportReason?: string;
  warnings: string[];
  hasSnapshot: boolean;
  /** A space with this name already exists under kbRoot. Import refuses
   *  to merge into an existing space (unlike New space, which opens it),
   *  so the UI surfaces this up-front instead of letting the user click
   *  through to a `SPACE_EXISTS` error. */
  nameTaken: boolean;
}

export interface ImportFolderOptions {
  source: string;
  kbRoot: string;
  name?: string;
  mode?: ImportFolderMode;
  confirmExisting?: boolean;
  confirmLargeImport?: boolean;
}

export interface ImportFolderResult {
  path: string;
  name: string;
  mode: ImportFolderMode;
  /** Set only on a `move` where the copy succeeded but deleting the
   *  original folder failed (permissions / file in use). The new space
   *  is intact and usable; this tells the caller the source still needs
   *  manual cleanup. */
  warning?: string;
}

const CONFIRM_ENTRY_LIMIT = 0;
const LARGE_IMPORT_ENTRY_LIMIT = 10_000;
const LARGE_IMPORT_BYTES = 1024 ** 3;
const IMPORT_STAGE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Cap on how deep `scanFolder` walks before it stops counting. A
 *  preview is informational, not a manifest — without a bound, pointing
 *  the picker at a tens-of-GB tree would block the server on a full
 *  recursive stat. Past the cap we report an approximate count and warn.
 *  The real copy still walks everything, but that's a deliberate,
 *  user-confirmed action rather than an incidental preview. */
const SCAN_ENTRY_CAP = 50_000;

export function previewFolderImport(
  opts: Pick<ImportFolderOptions, 'source' | 'kbRoot' | 'name'>,
): FolderImportPreview {
  const source = normalizeSource(opts.source);
  const kbRoot = path.resolve(opts.kbRoot);
  assertImportableSource(source, kbRoot);

  const name = (opts.name?.trim() || path.basename(source)).trim();
  const badName = validateSpaceName(name);
  if (badName) throw new Error(badName);

  const destination = path.join(kbRoot, name);
  const stats = scanFolder(source, kbRoot);
  const largeImportReason = getLargeImportReason(stats.entryCount, stats.totalBytes, stats.truncated);
  const warnings = buildWarnings(source, kbRoot, name, stats.entryCount, stats.totalBytes, stats.truncated);

  return {
    source,
    name,
    destination,
    exists: stats.entryCount > 0,
    entryCount: stats.entryCount,
    totalBytes: stats.totalBytes,
    requiresConfirmation: stats.entryCount > CONFIRM_ENTRY_LIMIT,
    requiresLargeImportConfirmation: largeImportReason !== undefined,
    largeImportReason,
    warnings,
    hasSnapshot: fileExists(path.join(source, '.stashbase', 'snapshot.parquet')),
    nameTaken: dirExists(destination),
  };
}

export function importFolderAsSpace(opts: ImportFolderOptions): ImportFolderResult {
  const mode = opts.mode ?? 'copy';
  if (mode !== 'copy' && mode !== 'move') throw new Error('mode must be "copy" or "move"');
  const preview = previewFolderImport(opts);
  if (mode === 'move' && isSymlink(preview.source)) {
    throw new Error('cannot move a symlinked folder; copy it instead, or move the real folder');
  }
  if (preview.requiresConfirmation && opts.confirmExisting !== true) {
    const err = new Error('confirmation required before importing this folder');
    (err as any).code = 'CONFIRM_EXISTING';
    throw err;
  }
  if (preview.requiresLargeImportConfirmation && opts.confirmLargeImport !== true) {
    const err = new Error('large folder confirmation required before importing this folder');
    (err as any).code = 'CONFIRM_LARGE_IMPORT';
    throw err;
  }

  fs.mkdirSync(path.dirname(preview.destination), { recursive: true });
  if (!dirExists(path.dirname(preview.destination))) throw new Error('knowledge base root is not a directory');
  if (fs.existsSync(preview.destination)) {
    const err = new Error(`space "${preview.name}" already exists`);
    (err as any).code = 'SPACE_EXISTS';
    throw err;
  }

  // Phase 1 — build the new space under the internal staging directory.
  // A crash mid-copy may leave a staging folder, but never a half-imported
  // visible space under <kbRoot>/<name>.
  const kbRoot = path.dirname(preview.destination);
  const kbRootReal = kbRootRealpath(kbRoot);
  const stash = path.join(kbRootReal, '.stashbase');
  fs.mkdirSync(stash, { recursive: true });
  cleanupOldImportStages(stash);
  const stagingRoot = fs.mkdtempSync(path.join(stash, 'import-stage-'));
  const staged = path.join(stagingRoot, preview.name);
  try {
    copyDirectoryDereferenced(preview.source, staged, {
      exclude: isImportExcludedEntry,
      validateEntry: (_relPath, _sourcePath, _entry, stat, realPath) => {
        assertImportableTarget(realPath, stat.isDirectory(), kbRootReal);
      },
    });
    pruneStashbasePerMachineState(path.join(staged, '.stashbase'));
    ensureSpaceMetadata(staged);
  } catch (err) {
    try { fs.rmSync(stagingRoot, { recursive: true, force: true }); } catch { /* best-effort rollback */ }
    throw err;
  }

  // Phase 2 — commit the completed staged space into the KB root. The
  // destination is checked again to handle races with another import.
  try {
    if (fs.existsSync(preview.destination)) {
      const err = new Error(`space "${preview.name}" already exists`);
      (err as any).code = 'SPACE_EXISTS';
      throw err;
    }
    fs.renameSync(staged, preview.destination);
  } catch (err) {
    try { fs.rmSync(stagingRoot, { recursive: true, force: true }); } catch { /* best-effort rollback */ }
    throw err;
  }
  try { fs.rmSync(stagingRoot, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }

  // Phase 3 — for a move, delete the original now that the copy is
  // committed. This is deliberately *outside* the rollback above: if
  // deleting the source fails partway (permissions / file in use), the
  // new space is already complete and must be kept. Tearing it down here
  // would lose data on both sides. Surface a warning instead so the user
  // can clean up the leftover original by hand.
  if (mode === 'move') {
    try {
      fs.rmSync(preview.source, { recursive: true, force: false });
    } catch {
      return {
        path: preview.destination,
        name: preview.name,
        mode,
        warning: `Imported into "${preview.name}", but the original folder at ${preview.source} could not be fully removed. Please delete it manually.`,
      };
    }
  }
  return { path: preview.destination, name: preview.name, mode };
}

function normalizeSource(raw: string): string {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('source required');
  let expanded = raw.trim();
  if (expanded === '~' || expanded.startsWith('~/')) expanded = path.join(os.homedir(), expanded.slice(1));
  const source = path.resolve(expanded);
  if (!dirExists(source)) throw new Error(fs.existsSync(source) ? 'source is not a directory' : 'source not found');
  return source;
}

function assertImportableSource(source: string, kbRoot: string): void {
  const home = os.homedir();
  const sourceReal = fs.realpathSync(source);
  const kbRootReal = kbRootRealpath(kbRoot);
  const homeReal = kbRootRealpath(home);
  if (
    samePath(source, home) ||
    samePath(sourceReal, homeReal) ||
    source === path.parse(source).root ||
    sourceReal === path.parse(sourceReal).root
  ) {
    throw new Error('refusing to import home or filesystem root');
  }
  const isInsideKb = samePath(source, kbRoot)
    || pathContains(kbRoot, source)
    || samePath(sourceReal, kbRootReal)
    || pathContains(kbRootReal, sourceReal);
  if (isInsideKb) {
    throw new Error('source is already inside the knowledge base; use Open space');
  }
  const containsKbRoot = pathContains(source, kbRoot) || pathContains(sourceReal, kbRootReal);
  if (containsKbRoot) {
    throw new Error('source contains the KB root; choose a more specific folder');
  }
}

function isImportExcludedEntry(relPath: string, _entry: fs.Dirent): boolean {
  if (pathHasCloudPlaceholder(relPath)) return true;
  const parts = relPath.split('/');
  if (parts[0] !== '.stashbase') return false;
  const entry = parts[1];
  if (!entry) return false;
  if (STASHBASE_PER_MACHINE_ENTRIES.includes(entry)) return true;
  if (entry.startsWith('state.db-')) return true;
  return entry === 'pdf-status.json' || entry === 'pdf-status.json.migrated';
}

function scanFolder(source: string, kbRoot: string): { entryCount: number; totalBytes: number; truncated: boolean } {
  let entryCount = 0;
  let totalBytes = 0;
  const sourceReal = fs.realpathSync(source);
  const kbRootReal = kbRootRealpath(kbRoot);
  const stack: Array<{ dir: string; rel: string; ancestors: Set<string> }> = [
    { dir: source, rel: '', ancestors: new Set([sourceReal]) },
  ];
  while (stack.length) {
    if (entryCount >= SCAN_ENTRY_CAP) return { entryCount, totalBytes, truncated: true };
    const frame = stack.pop()!;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(frame.dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const rel = frame.rel ? `${frame.rel}/${entry.name}` : entry.name;
      if (isImportExcludedEntry(rel, entry)) continue;
      if (entryCount >= SCAN_ENTRY_CAP) return { entryCount, totalBytes, truncated: true };
      entryCount += 1;
      const full = path.join(frame.dir, entry.name);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(full);
      } catch {
        /* Unreadable entries are surfaced by copy during import. */
        continue;
      }
      if (stat.isFile()) totalBytes += stat.size;
      const real = fs.realpathSync(full);
      assertImportableTarget(real, stat.isDirectory(), kbRootReal);
      if (stat.isDirectory()) {
        if (frame.ancestors.has(real)) throw new Error(`cyclic symlink detected: ${full}`);
        stack.push({ dir: full, rel, ancestors: new Set([...frame.ancestors, real]) });
      }
    }
  }
  return { entryCount, totalBytes, truncated: false };
}

function getLargeImportReason(entryCount: number, totalBytes: number, truncated: boolean): string | undefined {
  if (truncated) return `${SCAN_ENTRY_CAP.toLocaleString()}+ items`;
  if (entryCount >= LARGE_IMPORT_ENTRY_LIMIT) return `${entryCount.toLocaleString()} items`;
  if (totalBytes >= LARGE_IMPORT_BYTES) return formatBytes(totalBytes);
  return undefined;
}

function buildWarnings(
  source: string,
  kbRoot: string,
  name: string,
  entryCount: number,
  totalBytes: number,
  truncated: boolean,
): string[] {
  const warnings: string[] = [];
  const home = os.homedir();
  const sensitiveNames = new Set(['Desktop', 'Documents', 'Downloads']);
  if (path.dirname(source) === home && sensitiveNames.has(path.basename(source))) {
    warnings.push(`This looks like your ${path.basename(source)} folder.`);
  }
  if (truncated) {
    warnings.push(`Large folder (${SCAN_ENTRY_CAP.toLocaleString()}+ items); the count below is approximate and importing may take a while.`);
  } else if (entryCount >= LARGE_IMPORT_ENTRY_LIMIT || totalBytes >= LARGE_IMPORT_BYTES) {
    warnings.push(`Large folder (${entryCount.toLocaleString()} items, ${formatBytes(totalBytes)}); importing may take a while.`);
  }
  if (entryCount > 0) {
    warnings.push('Importing copies this existing folder into your StashBase knowledge base.');
  }
  warnings.push(`Destination will be ${path.join(kbRoot, name)}.`);
  return warnings;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

function dirExists(p: string): boolean {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function fileExists(p: string): boolean {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function isSymlink(p: string): boolean {
  try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; }
}

function kbRootRealpath(kbRoot: string): string {
  try { return fs.realpathSync(kbRoot); } catch { return path.resolve(kbRoot); }
}

function samePath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}

function pathContains(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function assertImportableTarget(targetReal: string, isDirectory: boolean, kbRootReal: string): void {
  if (samePath(targetReal, kbRootReal) || pathContains(kbRootReal, targetReal)) {
    throw new Error('source includes an entry inside the knowledge base; choose a different folder');
  }
  if (isDirectory && pathContains(targetReal, kbRootReal)) {
    throw new Error('source contains the KB root; choose a more specific folder');
  }
}

function cleanupOldImportStages(stash: string, maxAgeMs = IMPORT_STAGE_MAX_AGE_MS): void {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(stash, { withFileTypes: true }); } catch { return; }
  const cutoff = Date.now() - maxAgeMs;
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('import-stage-')) continue;
    const full = path.join(stash, entry.name);
    try {
      const stat = fs.statSync(full);
      if (stat.mtimeMs <= cutoff) fs.rmSync(full, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  }
}
