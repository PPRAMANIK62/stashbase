/**
 * Space registry + config persistence.
 *
 * Two layers of persistent config:
 *
 *   1. Global  — `~/.stashbase/config.json` (0600; may hold the OpenAI key):
 *        - `recentSpaces`     most-recent first, capped at MAX_RECENT
 *        - `apiKey`           single user-level OpenAI key, shared across spaces
 *   2. Per-space — `<space>/.stashbase/config.json`:
 *        - `embedder.provider`   which provider THIS space is indexed with
 *
 * The provider is **per-space** so different spaces can use different
 * embedders without dragging each other through a re-index. The key is
 * global because it's a user identity thing — one OpenAI key per user.
 *
 * Default provider for a space with no config: openai if a global key
 * is set, else onnx. The choice is locked in (written to per-space
 * config) the first time the space gets bound by the indexer, so a
 * later "user added/removed key" doesn't silently flip already-indexed
 * spaces.
 *
 * The currently-open space is in-memory only — server restart goes
 * back to the welcome screen. Other modules subscribe to switches via
 * `onSwitch()`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { logger, errorMessage } from './log.ts';

const log = logger('space');

const CONFIG_DIR = path.join(os.homedir(), '.stashbase');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const MAX_RECENT = 10;

/** Default KB root: `~/Documents/StashBase/`. All spaces must live
 *  under this folder. Persisted in `config.json` so a future "change
 *  library location" UI can edit it; for now it's just the constant. */
const DEFAULT_KB_ROOT = path.join(os.homedir(), 'Documents', 'StashBase');

export interface RecentSpace {
  path: string;
  openedAt: string;
}

export type EmbedderProvider = 'onnx' | 'openai';

interface ConfigFile {
  /** Absolute path of the library root. All spaces must live under it.
   *  Defaults to `~/Documents/StashBase/`; persisted so a future UI
   *  can rebase it without changing code. */
  kbRoot?: string;
  recentSpaces?: RecentSpace[];
  /** Legacy field from when the concept was called "vault". Read for
   *  back-compat (existing users keep their recents) and rewritten as
   *  `recentSpaces` on the next write. */
  recentVaults?: RecentSpace[];
  apiKey?: string;
  /** Legacy field from the global-provider era. On read we migrate its
   *  `openaiKey` into `apiKey` and push the `provider` choice down into
   *  each known space's per-space config, then drop the field. */
  embedder?: { provider?: EmbedderProvider; openaiKey?: string };
  /** Currently selected CLI for the right-side terminal panel. The
   *  server knows the canonical registry; this just records which
   *  entry the user last picked. Defaults to 'claude'. */
  terminalCli?: string;
}

interface SpaceConfigFile {
  embedder?: { provider: EmbedderProvider };
}

let currentSpace: string | null = null;
const switchListeners: Array<(newRoot: string) => void> = [];

// ---------- KB root (library folder) ----------

/** Absolute path of the KB root folder. Reads from config if set,
 *  otherwise the default `~/Documents/StashBase/`. Always returns a
 *  normalised path — caller can compare directly. */
export function getKbRoot(): string {
  const raw = readConfig().kbRoot;
  const p = typeof raw === 'string' && raw.trim() ? raw.trim() : DEFAULT_KB_ROOT;
  return path.resolve(p);
}

/** True if `absPath` is the KB root itself or any descendant of it.
 *  The root itself is intentionally NOT considered "under root" so it
 *  can't be opened as a space — it's strictly a container. */
export function isUnderRoot(absPath: string): boolean {
  const root = getKbRoot();
  const target = path.resolve(absPath);
  if (target === root) return false;
  const rel = path.relative(root, target);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return true;
}

/** Current space's name, expressed as a kbRoot-relative POSIX path.
 *  E.g. `cs183b` or `work/research`. null if no space open.
 *
 *  This is the bridge between the rest of the server (which operates
 *  in space-relative paths) and the indexer (which uses kbRoot-relative
 *  paths so it can route to per-provider collections). See `toKbRel`
 *  / `fromKbRel`. */
export function getCurrentSpaceName(): string | null {
  const cs = getCurrentSpace();
  if (!cs) return null;
  const root = getKbRoot();
  if (cs === root) return null;
  const rel = path.relative(root, cs);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

/** Convert a space-relative path (`topic/note.md`) to a kbRoot-relative
 *  one (`cs183b/topic/note.md`). Throws if no space is open — every
 *  call site should already be inside a request that has space context. */
export function toKbRel(spaceRel: string): string {
  const name = getCurrentSpaceName();
  if (!name) throw new Error('no space open');
  return spaceRel ? `${name}/${spaceRel}` : name;
}

/** Convert a kbRoot-relative path to a space-relative one, or null if
 *  the path doesn't fall under the current space. Used to translate
 *  daemon-returned paths (search hits, status lists) back into the
 *  space-relative form the UI expects. */
export function fromKbRel(kbRel: string): string | null {
  const name = getCurrentSpaceName();
  if (!name) return null;
  if (kbRel === name) return '';
  const prefix = `${name}/`;
  if (!kbRel.startsWith(prefix)) return null;
  return kbRel.slice(prefix.length);
}

/** Walk the KB root looking for spaces (directories containing a
 *  `.stashbase/` subdir — markers that the user has opened them at
 *  some point). Returns kbRoot-relative POSIX paths. Depth-capped at 8
 *  to match the open-space picker. Used at server boot to bind every
 *  known space so MCP cross-space search has them all available. */
export function listKnownSpaces(): string[] {
  const root = getKbRoot();
  const out: string[] = [];
  walkForKnownSpaces(root, '', 0, out);
  out.sort();
  return out;
}

function walkForKnownSpaces(absDir: string, relPrefix: string, depth: number, out: string[]): void {
  if (depth > 8) return;
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(absDir, { withFileTypes: true }); }
  catch { return; }
  // A directory that contains a `.stashbase/` subdir is a space — the
  // user has opened it before. Record it AND stop descending (a space
  // doesn't contain other spaces under it from the binding standpoint;
  // its files are routed under its own collection).
  if (relPrefix && entries.some((e) => e.isDirectory() && e.name === '.stashbase')) {
    out.push(relPrefix);
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('.')) continue; // skip .git, .stashbase, etc.
    const rel = relPrefix ? `${relPrefix}/${e.name}` : e.name;
    walkForKnownSpaces(path.join(absDir, e.name), rel, depth + 1, out);
  }
}

/** Idempotent startup hook:
 *   1. Ensure the KB root exists (mkdir -p).
 *   2. Prune `recentSpaces` entries that are outside the root —
 *      enforces the new invariant ("all spaces must live under the
 *      root") so old recents from the unrestricted era don't keep
 *      offering invalid one-click opens. Persists the trimmed list. */
export function ensureKbRoot(): void {
  const root = getKbRoot();
  try {
    fs.mkdirSync(root, { recursive: true });
  } catch (err: any) {
    log.warn(`failed to create kbRoot ${root}: ${errorMessage(err)}`);
  }
  const cfg = readConfig();
  const before = cfg.recentSpaces ?? [];
  const after = before.filter((r) => isUnderRoot(r.path));
  if (after.length !== before.length) {
    cfg.recentSpaces = after;
    writeConfig(cfg);
    log.info(`pruned ${before.length - after.length} out-of-root recent(s) (kbRoot=${root})`);
  }
}

/** Absolute path of the currently open space, or null if none. */
export function getCurrentSpace(): string | null {
  return currentSpace;
}

/** Throws if no space is open — call this from request handlers that
 *  need space state. The thrown error carries a `code` so the route
 *  layer can map it to HTTP 412. */
export function requireCurrentSpace(): string {
  if (!currentSpace) {
    const err = new Error('no space open');
    (err as any).code = 'NO_SPACE';
    throw err;
  }
  return currentSpace;
}

/** Open a space at the given absolute path. Creates the directory if
 *  needed. Pushes to the recents list. Notifies switch listeners so
 *  cached resources can be reset. */
export function setCurrentSpace(absPath: string): void {
  if (typeof absPath !== 'string' || !absPath) throw new Error('path required');
  // Expand a leading `~` so the welcome screen can accept `~/Notes`
  // without forcing the user to spell out their home directory.
  let expanded = absPath;
  if (expanded === '~' || expanded.startsWith('~/')) {
    expanded = path.join(os.homedir(), expanded.slice(1));
  }
  if (!path.isAbsolute(expanded)) throw new Error('path must be absolute');
  const normalized = path.resolve(expanded);
  // Spaces are strictly constrained to live under the KB root. The
  // SpacePicker UI only surfaces in-root folders, but this check is
  // defence-in-depth for direct API hits / stale recent entries that
  // slipped through the boot prune.
  if (!isUnderRoot(normalized)) {
    throw new Error(`space must live under ${getKbRoot()}`);
  }
  // Opening a brand-new folder is a valid flow (user picked a fresh
  // location for a new knowledge base), but silently mkdir-ing an
  // arbitrary path turns "I typo'd ~/Notess" into a ghost directory.
  // Warn loudly when we create from scratch so it shows up in logs;
  // existing dirs pass through silently.
  const existed = fs.existsSync(normalized);
  if (!existed) {
    fs.mkdirSync(normalized, { recursive: true });
    log.warn(`created new space directory: ${normalized}`);
  }
  const st = fs.statSync(normalized);
  if (!st.isDirectory()) throw new Error('path is not a directory');

  const changed = currentSpace !== normalized;
  currentSpace = normalized;
  pushRecent(normalized);
  if (changed) {
    for (const fn of switchListeners) {
      try { fn(normalized); } catch (err) {
        log.warn(`switch listener threw: ${(err as any)?.message ?? err}`);
      }
    }
  }
}

/** Subscribe to space switches. The listener receives the absolute path
 *  of the newly-current space; fires after the switch is in place. */
export function onSwitch(fn: (newRoot: string) => void): void {
  switchListeners.push(fn);
}

/** Returns recent spaces, most-recent first. Filters out paths that no
 *  longer exist on disk OR have drifted outside the KB root (e.g. a
 *  user moved the library folder externally) so the Welcome list only
 *  shows one-click-openable spaces. */
export function getRecentSpaces(): RecentSpace[] {
  const all = readConfig().recentSpaces ?? [];
  return all.filter((v) => {
    if (!isUnderRoot(v.path)) return false;
    try { return fs.statSync(v.path).isDirectory(); } catch { return false; }
  });
}

function pushRecent(absPath: string): void {
  const cfg = readConfig();
  const list = cfg.recentSpaces ?? [];
  // Filter out the entry we're about to re-add (avoid dupes) AND
  // entries whose target folder no longer exists — keeps the persisted
  // recents from accumulating dead tmp dirs / deleted folders over
  // time. Opportunistic cleanup on every write.
  const filtered = list.filter((v) => {
    if (v.path === absPath) return false;
    try { return fs.statSync(v.path).isDirectory(); } catch { return false; }
  });
  filtered.unshift({ path: absPath, openedAt: new Date().toISOString() });
  cfg.recentSpaces = filtered.slice(0, MAX_RECENT);
  // Drop the legacy field once we've migrated its content forward.
  delete cfg.recentVaults;
  writeConfig(cfg);
}

function readConfig(): ConfigFile {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    // Migrate `recentVaults` → `recentSpaces` on read so legacy users
    // don't lose their list when the rename rolls out.
    if (parsed.recentVaults && !parsed.recentSpaces) {
      parsed.recentSpaces = parsed.recentVaults;
    }
    return parsed as ConfigFile;
  } catch {
    return {};
  }
}

function writeConfig(cfg: ConfigFile): void {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    const tmp = CONFIG_FILE + '.tmp';
    // 0600 — config may carry the OpenAI key; keep it owner-only.
    fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, CONFIG_FILE);
  } catch (err: any) {
    log.warn(`failed to persist config: ${errorMessage(err)}`);
  }
}

// ---------- API key (global) ----------

/** Returns the user's stored OpenAI key, or undefined if none. */
export function getApiKey(): string | undefined {
  const k = readConfig().apiKey;
  return k && typeof k === 'string' && k.trim() ? k : undefined;
}

/** Persist (or clear, when `key` is falsy) the user's OpenAI key. */
export function setApiKey(key: string | undefined): void {
  const cfg = readConfig();
  if (key && key.trim()) cfg.apiKey = key.trim();
  else delete cfg.apiKey;
  writeConfig(cfg);
}

/** Currently selected CLI for the terminal panel. Defaults to
 *  'claude' so a fresh install opens the most popular option. */
export function getTerminalCli(): string {
  const v = readConfig().terminalCli;
  return typeof v === 'string' && v ? v : 'claude';
}

export function setTerminalCli(id: string): void {
  if (typeof id !== 'string' || !id) throw new Error('cli id required');
  const cfg = readConfig();
  cfg.terminalCli = id;
  writeConfig(cfg);
}

// ---------- Per-space embedder provider ----------

function spaceConfigPath(spaceRoot: string): string {
  return path.join(spaceRoot, '.stashbase', 'config.json');
}

function readSpaceConfig(spaceRoot: string): SpaceConfigFile {
  try {
    const raw = fs.readFileSync(spaceConfigPath(spaceRoot), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as SpaceConfigFile : {};
  } catch {
    return {};
  }
}

function writeSpaceConfig(spaceRoot: string, cfg: SpaceConfigFile): void {
  try {
    const dir = path.join(spaceRoot, '.stashbase');
    fs.mkdirSync(dir, { recursive: true });
    const file = spaceConfigPath(spaceRoot);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  } catch (err: any) {
    log.warn(`failed to persist space config at ${spaceRoot}: ${errorMessage(err)}`);
  }
}

/** Read the provider configured for a space. Falls back to **always
 *  `openai`** for spaces that haven't been bound yet — Local is the
 *  explicit fallback, OpenAI is the default goal. The fallback is
 *  *not* persisted here; `lockInSpaceProvider` does that, called by
 *  the indexer on bind. When the user has no key,
 *  `resolveSpaceEmbedder` silently degrades to `onnx` and the UI pops
 *  a modal asking them to add one. */
export function getSpaceEmbedderProvider(spaceRoot: string): EmbedderProvider {
  const p = readSpaceConfig(spaceRoot).embedder?.provider;
  if (p === 'onnx' || p === 'openai') return p;
  return 'openai';
}

/** Persist the provider for a space. The caller is responsible for
 *  triggering a re-index when this changes — the file write itself
 *  doesn't touch Milvus. */
export function setSpaceEmbedderProvider(spaceRoot: string, provider: EmbedderProvider): void {
  if (provider !== 'onnx' && provider !== 'openai') {
    throw new Error(`unsupported provider: ${provider}`);
  }
  writeSpaceConfig(spaceRoot, { embedder: { provider } });
}

/** If the space has no persisted provider yet, **lock it in as
 *  `openai`** — that's the new default; users get prompted for a key
 *  from the UI if missing. Existing spaces (already `onnx` or
 *  `openai` on disk) are left as-is, so a global default change won't
 *  silently re-embed anything. Returns the persisted provider.
 *  Idempotent. */
export function lockInSpaceProvider(spaceRoot: string): EmbedderProvider {
  const existing = readSpaceConfig(spaceRoot).embedder?.provider;
  if (existing === 'onnx' || existing === 'openai') return existing;
  const provider: EmbedderProvider = 'openai';
  setSpaceEmbedderProvider(spaceRoot, provider);
  return provider;
}

// ---------- Legacy migration ----------

/** One-time upgrade from the old global-embedder schema. Reads the
 *  `embedder.openaiKey` into the new top-level `apiKey`, and pushes
 *  the old global `embedder.provider` down into each known space's
 *  per-space config (so existing indexed spaces don't get re-embedded
 *  by surprise). Then drops the legacy field. Safe to call repeatedly:
 *  if `cfg.embedder` is already gone, this is a no-op. */
export function migrateLegacyEmbedderConfig(): void {
  const cfg = readConfig();
  if (!cfg.embedder) return;

  const oldKey = cfg.embedder.openaiKey;
  if (oldKey && typeof oldKey === 'string' && !cfg.apiKey) {
    cfg.apiKey = oldKey.trim();
  }

  const oldProvider = cfg.embedder.provider;
  if (oldProvider === 'onnx' || oldProvider === 'openai') {
    for (const r of cfg.recentSpaces ?? []) {
      try {
        if (!fs.statSync(r.path).isDirectory()) continue;
      } catch {
        continue;
      }
      // Only seed per-space when there's no choice yet — never overwrite
      // an existing per-space setting.
      if (readSpaceConfig(r.path).embedder?.provider) continue;
      writeSpaceConfig(r.path, { embedder: { provider: oldProvider } });
    }
  }

  delete cfg.embedder;
  writeConfig(cfg);
  log.info('migrated legacy embedder config to per-space + global apiKey');
}
