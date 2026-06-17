/**
 * Space-management routes: open / create the active space and list
 * recent spaces.
 *
 * These are the only data routes that work BEFORE a space is open —
 * they live outside the `requireSpace` prefix gate. The `onSwitch`
 * listener wired in `server/state.ts` takes over once a space is set
 * to bind the indexer and kick off the background sync.
 */
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectFormat, getSpaceName, HIDDEN_DOT_DIRS } from '../files.ts';
import { indexableFileSizeError, isCloudPlaceholderName, isIndexExcludedDirName, shouldIndexFilePath } from '../indexable.ts';
import { matchNoteStem } from '../format.ts';
import {
  clearSpacePath,
  clearCurrentSpace,
  deleteSpaceConfig,
  ensureKbRoot,
  getCurrentSpace,
  getCurrentSpaceName,
  getKbRoot,
  getRecentSpaces,
  getActiveSpaces,
  getSpaceConfigPath,
  requireSpaceExistsByName,
  listAvailableSpaceNames,
  needsKbRootPicker,
  previewKbRootMigration,
  readSpaceConfig,
  renameSpaceConfig,
  replaceCurrentSpacePath,
  resolveSpaceConfig,
  setCurrentSpace,
  setKbRoot,
  validateSpaceName,
  writeSpaceConfig,
  type MigrateEntry,
} from '../space.ts';
import { errorMessage, logger } from '../log.ts';
import { deleteSpaceRuntimeState, indexer, invalidateSpaceSync, renameSpaceRuntimeState } from '../state.ts';
import { switchSpaceMcpServers } from '../mcp-host.ts';
import { deleteSpaceState, renameSpaceState } from '../state-db.ts';
import { hasInFlightUnder } from '../conversion-status.ts';
import { noteTreeChanged } from '../watcher.ts';
import {
  importFolderAsSpace,
  previewFolderImport,
  type ImportFolderMode,
} from '../import-folder.ts';

const log = logger('routes/space');

export function mount(app: express.Express): void {
  // List the open + recent spaces. Powers the Welcome screen. Includes
  // homeDir so the renderer can shorten `/Users/<name>/foo` to `~/foo`
  // (less personal info in screenshots).
  app.get('/api/space', (_req, res) => {
    const current = getCurrentSpace();
    res.json({
      current: current ? { path: current, name: getCurrentSpaceName() ?? path.basename(current) } : null,
      recent: getRecentSpaces(),
      homeDir: os.homedir(),
    });
  });

  // Switch to a different space. Accepts either `{ name }` (preferred —
  // a single segment under kbRoot) or legacy `{ path }` (absolute path
  // kept for any remaining callers / recent entries that haven't been
  // migrated). Returns immediately; the indexer catches up in the
  // background via `state.ts:onSwitch`.
  app.post('/api/space', async (req, res) => {
    const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const rawPath = typeof req.body?.path === 'string' ? req.body.path.trim() : '';
    if (!rawName && !rawPath) return res.status(400).json({ error: 'name or path required' });
    // `create:true` (New-space flow) lets the server mkdir a missing
    // folder. Open / recent flows omit it, so opening a name whose folder
    // is gone errors instead of resurrecting an empty dir.
    const create = req.body?.create === true;
    const exclusiveCreate = req.body?.exclusiveCreate === true;
    let target = rawPath;
    if (rawName) {
      const bad = validateSpaceName(rawName);
      if (bad) return res.status(400).json({ error: bad });
      target = path.join(getKbRoot(), rawName);
    }
    try {
      setCurrentSpace(target, { create, exclusiveCreate });
      const spaceRoot = getCurrentSpace()!;
      res.json({ current: { path: spaceRoot, name: getCurrentSpaceName() ?? getSpaceName() } });
    } catch (err: unknown) {
      if ((err as any)?.code === 'SPACE_EXISTS') {
        return res.status(409).json({ error: errorMessage(err), code: 'SPACE_EXISTS' });
      }
      res.status(400).json({ error: errorMessage(err) });
    }
  });

  // Close the current window's active space. Idempotent: if this window
  // is already on Welcome, there is nothing to do. This keeps the
  // server-side window binding in lockstep with renderer goHome(), so
  // subsequent polls return NO_SPACE instead of silently reviving the
  // previous space.
  app.delete('/api/space', (_req, res) => {
    try {
      clearCurrentSpace();
      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(400).json({ error: errorMessage(err) });
    }
  });

  // KB root: the folder all spaces must live under as direct
  // children. Surfaced to the renderer so it can render the home-
  // relative form (`~/Documents/StashBase`) in copy.
  app.get('/api/kb-root', (_req, res) => {
    // Re-create the root if it was deleted out from under a long-lived
    // server, but do NOT turn a truly empty first launch into an implicit
    // default-root choice. At boot, `index.ts` deliberately skips
    // `ensureKbRoot()` when `needsKbRootPicker()` is true so the required
    // first-run picker can persist the user's choice and trigger the
    // kbRoot-change listeners (seed + daemon bind). Calling ensure here in
    // that state would silently write `~/Documents/StashBase`, suppress
    // the picker, and miss those listeners.
    const root = getKbRoot();
    if (!needsKbRootPicker() && !fs.existsSync(root)) ensureKbRoot();
    res.json({ path: getKbRoot(), needsPicker: needsKbRootPicker() });
  });

  // Pre-flight for the "move my spaces over" flow: which spaces would
  // move, and which collide with same-named spaces in the target. Read
  // only — touches nothing.
  app.get('/api/kb-root/migration-preview', (req, res) => {
    const target = typeof req.query.target === 'string' ? req.query.target.trim() : '';
    if (!target) return res.status(400).json({ error: 'target required' });
    try {
      res.json(previewKbRootMigration(target));
    } catch (err: unknown) {
      res.status(400).json({ error: errorMessage(err) });
    }
  });

  app.put('/api/kb-root', async (req, res) => {
    const rawPath = typeof req.body?.path === 'string' ? req.body.path.trim() : '';
    if (!rawPath) return res.status(400).json({ error: 'path required' });
    const migrate = Array.isArray(req.body?.migrate)
      ? (req.body.migrate as MigrateEntry[])
      : undefined;
    try {
      const { warnings } = await setKbRoot(rawPath, {
        allowNonEmpty: req.body?.confirmNonEmpty === true,
        migrate,
      });
      res.json({ path: getKbRoot(), warnings });
    } catch (err: unknown) {
      if ((err as any)?.code === 'NON_EMPTY') {
        return res.status(409).json({ error: 'directory is not empty', code: 'NON_EMPTY' });
      }
      res.status(400).json({ error: errorMessage(err) });
    }
  });

  // List candidate space names — direct child directories of kbRoot.
  // Powers the "Open space" dropdown. Distinct from `recentSpaces`:
  // includes folders the user dropped in via Finder but never opened.
  app.get('/api/spaces/available', (_req, res) => {
    res.json({ names: listAvailableSpaceNames() });
  });

  app.get('/api/spaces/:name/config', (req, res) => {
    const name = req.params.name;
    const bad = validateSpaceName(name);
    if (bad) return res.status(400).json({ error: bad });
    try {
      requireSpaceExistsByName(name);
      res.json({
        path: getSpaceConfigPath(name),
        local: readSpaceConfig(name),
        resolved: resolveSpaceConfig(name),
      });
    } catch (err: unknown) {
      if ((err as any)?.code === 'SPACE_NOT_FOUND') return res.status(404).json({ error: 'space not found' });
      res.status(400).json({ error: errorMessage(err) });
    }
  });

  app.put('/api/spaces/:name/config', (req, res) => {
    const name = req.params.name;
    const bad = validateSpaceName(name);
    if (bad) return res.status(400).json({ error: bad });
    try {
      requireSpaceExistsByName(name);
      writeSpaceConfig(name, req.body ?? {});
      for (const active of getActiveSpaces()) {
        if (path.basename(active.path) === name) {
          void switchSpaceMcpServers(active.windowId, active.path);
        }
      }
      res.json({
        path: getSpaceConfigPath(name),
        local: readSpaceConfig(name),
        resolved: resolveSpaceConfig(name),
      });
    } catch (err: unknown) {
      if ((err as any)?.code === 'SPACE_NOT_FOUND') return res.status(404).json({ error: 'space not found' });
      res.status(400).json({ error: errorMessage(err) });
    }
  });

  app.patch('/api/spaces/:name', async (req, res) => {
    const oldName = req.params.name;
    const newName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const oldErr = validateSpaceName(oldName);
    if (oldErr) return res.status(400).json({ error: oldErr });
    const newErr = validateSpaceName(newName);
    if (newErr) return res.status(400).json({ error: newErr });
    if (oldName === newName) return res.json({ name: oldName });
    const root = getKbRoot();
    const oldPath = path.join(root, oldName);
    const newPath = path.join(root, newName);
    try {
      if (!fs.existsSync(oldPath)) return res.status(404).json({ error: 'space not found' });
      if (fs.existsSync(newPath)) return res.status(409).json({ error: `space "${newName}" already exists` });
      assertNoInFlightSpaceConversion(oldName);
      invalidateSpaceSync(oldName);
      fs.renameSync(oldPath, newPath);
      try {
        const files = collectIndexableFilesForRename(newPath, oldName);
        await indexer.renamePathPrefix(oldName, newName, files);
      } catch (err) {
        try { fs.renameSync(newPath, oldPath); } catch { /* leave original error */ }
        throw err;
      }
      replaceCurrentSpacePath(oldPath, newPath);
      // Carry persisted conversion failures through the rename so the
      // Retry banner remains attached to the same source under its new
      // kbRoot-relative prefix. Delete semantics are only for actual
      // space deletion.
      renameSpaceState(oldName, newName);
      await renameSpaceRuntimeState(oldName, newName);
      try { renameSpaceConfig(oldName, newName); }
      catch (err: unknown) { log.warn(`space config rename failed for ${oldName} -> ${newName}: ${errorMessage(err)}`); }
      noteTreeChanged();
      res.json({ name: newName, path: newPath });
    } catch (err: unknown) {
      sendSpaceOperationError(res, err);
    }
  });

  app.delete('/api/spaces/:name', async (req, res) => {
    const name = req.params.name;
    const bad = validateSpaceName(name);
    if (bad) return res.status(400).json({ error: bad });
    const target = path.join(getKbRoot(), name);
    try {
      if (!fs.existsSync(target)) return res.status(404).json({ error: 'space not found' });
      assertNoInFlightSpaceConversion(name);
      invalidateSpaceSync(name);
      // Tear down live runtime bound to this space FIRST (kills the
      // terminal PTY, stops per-space MCP servers via onClose) so
      // nothing is still bound when the directory vanishes under it.
      clearSpacePath(target);
      fs.rmSync(target, { recursive: true, force: true });
      // Clear derived state: vector-store chunks + the three state.db
      // tables. Without the state.db sweep, orphan rows survive the
      // delete — most visibly a stale conversions record that makes
      // a later same-named PDF skip auto-conversion (see deleteSpaceState).
      await indexer.deletePathPrefix(name);
      deleteSpaceState(name);
      await deleteSpaceRuntimeState(name);
      try { deleteSpaceConfig(name); }
      catch (err: unknown) { log.warn(`space config delete failed for ${name}: ${errorMessage(err)}`); }
      noteTreeChanged();
      res.json({});
    } catch (err: unknown) {
      sendSpaceOperationError(res, err);
    }
  });

  // Preview + import an existing local folder as a new space under
  // <kbRoot>/<name>. The import helper handles the safety rules:
  // no in-library sources, no merge into existing spaces, copy by
  // default, optional copy-then-delete move, and symlink dereference.
  app.post('/api/space/import-folder/preview', (req, res) => {
    try {
      const source = typeof req.body?.source === 'string' ? req.body.source : '';
      const name = typeof req.body?.name === 'string' ? req.body.name : '';
      res.json(previewFolderImport({ source, name, kbRoot: getKbRoot() }));
    } catch (err: unknown) {
      res.status(400).json({ error: errorMessage(err) });
    }
  });

  app.post('/api/space/import-folder', (req, res) => {
    try {
      const source = typeof req.body?.source === 'string' ? req.body.source : '';
      const name = typeof req.body?.name === 'string' ? req.body.name : '';
      const rawMode = req.body?.mode;
      if (rawMode !== undefined && rawMode !== 'copy' && rawMode !== 'move') {
        return res.status(400).json({ error: 'mode must be "copy" or "move"' });
      }
      const mode: ImportFolderMode = rawMode === 'move' ? 'move' : 'copy';
      const confirmExisting = req.body?.confirmExisting === true;
      const confirmLargeImport = req.body?.confirmLargeImport === true;
      const result = importFolderAsSpace({
        source,
        name,
        mode,
        confirmExisting,
        confirmLargeImport,
        kbRoot: getKbRoot(),
      });
      res.json(result);
    } catch (err: unknown) {
      if ((err as any)?.code === 'CONFIRM_EXISTING') {
        return res.status(409).json({ error: errorMessage(err), code: 'CONFIRM_EXISTING' });
      }
      if ((err as any)?.code === 'CONFIRM_LARGE_IMPORT') {
        return res.status(409).json({ error: errorMessage(err), code: 'CONFIRM_LARGE_IMPORT' });
      }
      if ((err as any)?.code === 'SPACE_EXISTS') {
        return res.status(409).json({ error: errorMessage(err), code: 'SPACE_EXISTS' });
      }
      res.status(400).json({ error: errorMessage(err) });
    }
  });

}

export function assertNoInFlightSpaceConversion(spaceName: string): void {
  if (!hasInFlightUnder(spaceName)) return;
  const err = new Error('space has conversions in progress');
  (err as any).status = 409;
  (err as any).code = 'CONVERSION_IN_FLIGHT';
  throw err;
}

function sendSpaceOperationError(res: express.Response, err: unknown): void {
  const status = (err as { status?: unknown })?.status;
  const code = (err as { code?: unknown })?.code;
  if (typeof status === 'number' && status >= 400 && status <= 599) {
    res.status(status).json({
      error: errorMessage(err),
      ...(typeof code === 'string' ? { code } : {}),
    });
    return;
  }
  res.status(400).json({ error: errorMessage(err) });
}

function collectIndexableFilesForRename(
  spaceRoot: string,
  oldSpaceName: string,
): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  walkSpace(spaceRoot, '', (rel, full, ent) => {
    if (!ent.isFile() || !detectFormat(ent.name) || !shouldIndexFilePath(rel)) return;
    if (indexableFileSizeError(full)) return;
    const oldPath = rel ? `${oldSpaceName}/${rel}` : oldSpaceName;
    files.push({ path: oldPath, content: fs.readFileSync(full, 'utf8') });
  });
  return files;
}

function walkSpace(
  dir: string,
  prefix: string,
  fn: (rel: string, full: string, ent: fs.Dirent) => void,
): void {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  const noteStems = new Set<string>();
  for (const e of entries) {
    if (!e.isFile()) continue;
    const m = matchNoteStem(e.name);
    if (m) noteStems.add(m.stem);
  }
  for (const e of entries) {
    if (isCloudPlaceholderName(e.name)) continue;
    if (e.name.startsWith('.') && HIDDEN_DOT_DIRS.has(e.name)) continue;
    if (e.isDirectory() && isIndexExcludedDirName(e.name)) continue;
    if (e.isDirectory() && e.name.endsWith('_files')) {
      const stem = e.name.slice(0, -'_files'.length);
      if (noteStems.has(stem)) continue;
    }
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    const full = path.join(dir, e.name);
    fn(rel, full, e);
    if (e.isDirectory()) walkSpace(full, rel, fn);
  }
}
