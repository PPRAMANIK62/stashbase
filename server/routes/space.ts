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
import { getSpaceName } from '../files.ts';
import {
  getCurrentSpace,
  getKbRoot,
  getRecentSpaces,
  listAvailableSpaceNames,
  setCurrentSpace,
  validateSpaceName,
} from '../space.ts';
import { errorMessage } from '../log.ts';
import { sendError } from '../http.ts';

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
    res.json({ path: getKbRoot() });
  });

  // List candidate space names — direct child directories of kbRoot.
  // Powers the "Open space" dropdown. Distinct from `recentSpaces`:
  // includes folders the user dropped in via Finder but never opened.
  app.get('/api/spaces/available', (_req, res) => {
    res.json({ names: listAvailableSpaceNames() });
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
