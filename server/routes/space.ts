/**
 * Space-management routes: open / create the active space, list recent
 * spaces, and clone a git repo as the starting point of a new space.
 *
 * These are the only data routes that work BEFORE a space is open —
 * they live outside the `requireSpace` prefix gate. The `onSwitch`
 * listener wired in `server/state.ts` takes over once a space is set
 * to bind the indexer and kick off the background sync.
 */
import express from 'express';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectFormat, getSpaceName, HIDDEN_DOT_DIRS } from '../files.ts';
import {
  clearSpacePath,
  getCurrentSpace,
  getKbRoot,
  getRecentSpaces,
  getActiveSpaces,
  getSpaceConfigPath,
  requireSpaceExistsByName,
  listAvailableSpaceNames,
  needsKbRootPicker,
  readSpaceConfig,
  replaceCurrentSpacePath,
  resolveSpaceConfig,
  setCurrentSpace,
  setKbRoot,
  validateSpaceName,
  writeSpaceConfig,
} from '../space.ts';
import { errorMessage } from '../log.ts';
import { sendError } from '../http.ts';
import { indexer } from '../state.ts';
import { switchSpaceMcpServers } from '../mcp-host.ts';

export function mount(app: express.Express): void {
  // List the open + recent spaces. Powers the Welcome screen. Includes
  // homeDir so the renderer can shorten `/Users/<name>/foo` to `~/foo`
  // (less personal info in screenshots).
  app.get('/api/space', (_req, res) => {
    const current = getCurrentSpace();
    res.json({
      current: current ? { path: current, name: path.basename(current) } : null,
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
    let target = rawPath;
    if (rawName) {
      const bad = validateSpaceName(rawName);
      if (bad) return res.status(400).json({ error: bad });
      target = path.join(getKbRoot(), rawName);
    }
    try {
      setCurrentSpace(target);
      const spaceRoot = getCurrentSpace()!;
      res.json({ current: { path: spaceRoot, name: getSpaceName() } });
    } catch (err: unknown) {
      res.status(400).json({ error: errorMessage(err) });
    }
  });

  // Library root: the folder all spaces must live under as direct
  // children. Surfaced to the renderer so it can render the home-
  // relative form (`~/Documents/StashBase`) in copy.
  app.get('/api/kb-root', (_req, res) => {
    res.json({ path: getKbRoot(), needsPicker: needsKbRootPicker() });
  });

  app.put('/api/kb-root', async (req, res) => {
    const rawPath = typeof req.body?.path === 'string' ? req.body.path.trim() : '';
    if (!rawPath) return res.status(400).json({ error: 'path required' });
    try {
      await setKbRoot(rawPath, { allowNonEmpty: req.body?.confirmNonEmpty === true });
      res.json({ path: getKbRoot() });
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
          switchSpaceMcpServers(active.windowId, active.path);
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
      fs.renameSync(oldPath, newPath);
      try {
        const files = collectIndexableFilesForRename(newPath, oldName);
        await indexer.renamePathPrefix(oldName, newName, files);
      } catch (err) {
        try { fs.renameSync(newPath, oldPath); } catch { /* leave original error */ }
        throw err;
      }
      replaceCurrentSpacePath(oldPath, newPath);
      res.json({ name: newName, path: newPath });
    } catch (err: unknown) {
      res.status(400).json({ error: errorMessage(err) });
    }
  });

  app.delete('/api/spaces/:name', async (req, res) => {
    const name = req.params.name;
    const bad = validateSpaceName(name);
    if (bad) return res.status(400).json({ error: bad });
    const target = path.join(getKbRoot(), name);
    try {
      if (!fs.existsSync(target)) return res.status(404).json({ error: 'space not found' });
      fs.rmSync(target, { recursive: true, force: true });
      clearSpacePath(target);
      await indexer.deletePathPrefix(name);
      res.json({});
    } catch (err: unknown) {
      res.status(400).json({ error: errorMessage(err) });
    }
  });

  // Import an existing local folder as a new space by copying its
  // contents into <kbRoot>/<name>. Source can be anywhere on disk; the
  // copy is one-way (we never write back). Refuses if the source is
  // already under kbRoot (the user can just "Open space" instead), if
  // the destination already exists, or if the source is a sensitive
  // parent (home / kbRoot / root). UI follows up with POST /api/space.
  app.post('/api/space/import-folder', async (req, res) => {
    const rawSrc = typeof req.body?.source === 'string' ? req.body.source.trim() : '';
    const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!rawSrc) return res.status(400).json({ error: 'source required' });
    const src = path.resolve(rawSrc.replace(/^~/, os.homedir()));
    if (!fs.existsSync(src)) return res.status(404).json({ error: 'source not found' });
    if (!fs.statSync(src).isDirectory()) return res.status(400).json({ error: 'source is not a directory' });
    const home = os.homedir();
    const root = getKbRoot();
    // Refuse cases where copying would either be a no-op (already
    // under kbRoot) or a catastrophe (copying $HOME or `/` somewhere).
    if (src === home || src === path.parse(src).root) {
      return res.status(400).json({ error: 'refusing to import home or filesystem root' });
    }
    const relFromRoot = path.relative(root, src);
    const isUnderKb = src === root
      || (relFromRoot !== '' && !relFromRoot.startsWith('..') && !path.isAbsolute(relFromRoot));
    if (isUnderKb) {
      return res.status(400).json({ error: 'source is already inside the library; use Open space' });
    }
    const name = rawName || path.basename(src);
    const nameErr = validateSpaceName(name);
    if (nameErr) return res.status(400).json({ error: nameErr });
    try { fs.mkdirSync(root, { recursive: true }); } catch { /* fall through */ }
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      return res.status(400).json({ error: 'library root is not a directory' });
    }
    const dest = path.join(root, name);
    if (fs.existsSync(dest)) {
      return res.status(409).json({ error: `space "${name}" already exists` });
    }
    try {
      // Node's `fs.cp` (recursive copy) is sync-API stable since v16
      // and follows symlinks by default; we keep that behavior to
      // surface the user's content as plain files in the new space.
      // `dereference: true` here would inflate snapshot bundles —
      // leave default off; cps default behaviour preserves links.
      fs.cpSync(src, dest, { recursive: true });
      // Strip any per-machine .stashbase state that came along — same
      // reasoning as a clone (the new copy shouldn't inherit the old
      // host's embedder routing / Milvus DB).
      pruneClonedStashbase(path.join(dest, '.stashbase'));
      res.json({ path: dest });
    } catch (err: unknown) {
      sendError(res, err);
    }
  });

  // Clone a remote git repo into <kbRoot>/<name>, then return the
  // absolute working-tree path. UI follows up with POST /api/space to
  // actually open it. We block here until git exits so the caller can
  // flip "Cloning…" → "Opening…" in one step. `name` is optional; if
  // omitted we derive it from the URL.
  app.post('/api/git/clone', async (req, res) => {
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!url) return res.status(400).json({ error: 'url required' });
    // Whitelist schemes — refuse `file://` / `javascript:` / `--upload-pack=...`
    // and anything else that could escape into a git option or local file read.
    if (!/^(https?:\/\/|git@[\w.-]+:|ssh:\/\/|git:\/\/)/.test(url)) {
      return res.status(400).json({ error: 'url must be http(s) / ssh / git scheme' });
    }
    const name = rawName || inferRepoName(url);
    if (!name) return res.status(400).json({ error: 'could not derive repo name from url' });
    const nameErr = validateSpaceName(name);
    if (nameErr) return res.status(400).json({ error: nameErr });
    const root = getKbRoot();
    try { fs.mkdirSync(root, { recursive: true }); } catch { /* surface below if it still isn't a dir */ }
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      return res.status(400).json({ error: 'library root is not a directory' });
    }
    const dest = path.join(root, name);
    if (fs.existsSync(dest)) {
      return res.status(409).json({ error: `space "${name}" already exists` });
    }
    try {
      await spawnGitClone(url, dest, root);
      // Selective cleanup of the upstream `.stashbase/` directory.
      // Per-machine internal state (`config.json`, `mfs/`, `cache/`)
      // must never travel with a clone — they'd inherit the previous
      // user's embedder provider + Milvus collection dim, blocking a
      // fresh user without a key. The **portable** pieces stay:
      //   - `snapshot.parquet` — the exported chunk index that lets
      //     the new user skip re-embedding (auto-imported on bind)
      //   - any future portable artefacts the maintainer ships
      // `.git/` and other dotdirs are user content and stay.
      pruneClonedStashbase(path.join(dest, '.stashbase'));
      res.json({ path: dest });
    } catch (err: unknown) {
      sendError(res, err);
    }
  });
}

function collectIndexableFilesForRename(
  spaceRoot: string,
  oldSpaceName: string,
): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  walkSpace(spaceRoot, '', (rel, full, ent) => {
    if (!ent.isFile() || !detectFormat(ent.name)) return;
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
    const m = e.name.match(/^(.+)\.(md|markdown|html|htm)$/i);
    if (m) noteStems.add(m[1]);
  }
  for (const e of entries) {
    if (e.name.startsWith('.') && HIDDEN_DOT_DIRS.has(e.name)) continue;
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

/** Internal entries under `.stashbase/` that **must** be wiped after a
 *  clone — per-machine state, never portable. Everything else in the
 *  directory stays; the snapshot file lives here intentionally. */
const STASHBASE_PER_MACHINE_ENTRIES = ['config.json', 'mfs', 'cache'];

/** Selectively delete per-machine internal state out of a freshly-
 *  cloned space's `.stashbase/` directory, leaving portable artefacts
 *  (notably `snapshot.parquet`) intact. No-op if the directory doesn't
 *  exist. */
function pruneClonedStashbase(stashbaseDir: string): void {
  if (!fs.existsSync(stashbaseDir)) return;
  for (const entry of STASHBASE_PER_MACHINE_ENTRIES) {
    fs.rmSync(path.join(stashbaseDir, entry), { recursive: true, force: true });
  }
}

/** `https://github.com/user/repo.git` / `git@github.com:user/repo.git`
 *  / `ssh://git@host/path/repo` → `repo`. Returns null when the tail
 *  segment looks empty / weird (we'd rather fail loudly than clone into
 *  some surprise directory). */
function inferRepoName(url: string): string | null {
  const trimmed = url.replace(/\/+$/, '').replace(/\.git$/, '');
  const m = trimmed.match(/[/:]([A-Za-z0-9._-]+)$/);
  return m ? m[1] : null;
}

/** Spawn `git clone -- <url> <dest>`. The `--` guards against URLs
 *  that start with `-` being parsed as git options. We capture stderr
 *  so the rejection message tells the user what git actually
 *  complained about, not a generic "exit 128". */
function spawnGitClone(url: string, dest: string, cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = childProcess.spawn('git', ['clone', '--', url, dest], {
      cwd,
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, // never block on auth prompt
    });
    let stderr = '';
    proc.stderr.on('data', (b) => { stderr += b.toString(); });
    proc.on('error', (err) => reject(new Error(`git: ${err.message}`)));
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `git exited with code ${code}`));
    });
  });
}
