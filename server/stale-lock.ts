/**
 * Defensive cleanup of an orphaned Milvus Lite flock before binding a
 * folder. The story we keep hitting:
 *
 *   1. Previous StashBase session held the lock on
 *      the per-machine Milvus DB for this library.
 *   2. It exited dirtily — `kill -9`, force-quit, OS shutdown, or a
 *      shutdown that ran past our 4 s `indexer.close()` ceiling on a
 *      big library where Milvus's own flush takes longer.
 *   3. The previous Python daemon orphans, kernel keeps the flock
 *      held against its dead FD reference (rare on POSIX but happens
 *      with adopted orphans / FS quirks).
   *   4. New session spawns a fresh daemon, binds a folder,
 *      pymilvus raises `DataDirLockedError`, the user is stuck.
 *
 * What we do here: list the PIDs holding the db file via `lsof -t`,
 * filter to anything that looks like a stashbase daemon (Python or
 * the PyInstaller-frozen binary), and `kill -9` the lot. Anything
 * that isn't one of ours is left alone — we'd rather error on a
 * non-stashbase locker than risk killing a stranger's process.
 *
 * macOS + Linux only — `lsof` isn't a standard Windows tool. Windows
 * paths fall through silently; on those platforms the
 * "Most likely a stale stashbase_daemon" hint in the Python error
 * is still the user's recourse.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from './log.ts';
import { globalVectorStoreDir } from './local-data.ts';

const log = logger('stale-lock');

/** Kill any orphaned stashbase daemon still holding the flock on the
 *  global `milvus.db`. No-op when the db doesn't exist yet, when `lsof`
 *  isn't available, or when no one's holding the lock. */
export function clearStaleMilvusLock(): void {
  if (process.platform === 'win32') return;
  const candidates = [
    path.join(globalVectorStoreDir(), 'milvus.db'),
  ].filter((p) => fs.existsSync(p));
  if (candidates.length === 0) return;

  const lsof = spawnSync('lsof', ['-t', ...candidates], { encoding: 'utf8' });
  // `lsof -t <file>` exits 1 when nobody holds it (which is the happy
  // path — nothing to clean up). It exits 127 when lsof itself isn't
  // installed; we silently bail in both cases.
  if (lsof.status !== 0 || !lsof.stdout.trim()) return;

  const pids = lsof.stdout
    .trim()
    .split('\n')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0 && n !== process.pid);

  for (const pid of pids) {
    // Sanity-check the holder is one of ours. macOS `comm` truncates
    // long process names, so we accept any of: `stashbase-daemon`
    // (PyInstaller binary), `python`/`python3` (dev mode running
    // `stashbase_daemon.py`). Anything else, leave alone with a
    // breadcrumb in the log so the user can investigate.
    const ps = spawnSync('ps', ['-p', String(pid), '-o', 'comm='], { encoding: 'utf8' });
    if (ps.status !== 0) continue;
    const comm = ps.stdout.trim();
    const isOurs = /stashbase-daemon|stashbase_daemon|^python\d*$/i.test(comm);
    if (!isOurs) {
      log.warn(`milvus.db is held by pid=${pid} (${comm}) — not a stashbase daemon, leaving alone`);
      continue;
    }
    log.warn(`clearing stale milvus lock: killing orphan pid=${pid} (${comm})`);
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already dead — fine, the flock will be released by the kernel.
    }
  }
}

export interface PortHolderProcess {
  ppid: number;
  command: string;
}

export interface ReclaimStaleServerPortDeps {
  platform?: NodeJS.Platform;
  selfPid?: number;
  /** Pids currently LISTENing on the port (default: `lsof`). */
  listListenerPids?: (port: number) => number[];
  /** Parent pid + full command line for one pid (default: `ps`). */
  readProcess?: (pid: number) => PortHolderProcess | null;
  kill?: (pid: number) => void;
}

function listListenerPidsViaLsof(port: number): number[] {
  const lsof = spawnSync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], {
    encoding: 'utf8',
  });
  // Exit 1 = nobody listening; exit 127 = no lsof. Nothing to reclaim either way.
  if (lsof.status !== 0 || !lsof.stdout.trim()) return [];
  return lsof.stdout
    .trim()
    .split('\n')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function readProcessViaPs(pid: number): PortHolderProcess | null {
  const ps = spawnSync('ps', ['-p', String(pid), '-o', 'ppid=,command='], { encoding: 'utf8' });
  if (ps.status !== 0 || !ps.stdout.trim()) return null;
  const m = ps.stdout.trim().match(/^(\d+)\s+(.+)$/s);
  if (!m) return null;
  return { ppid: Number(m[1]), command: m[2] };
}

/** Kill an orphaned sibling server still holding our port — the leftover of
 *  an Electron owner that died without completing its kill ladder (crash,
 *  force quit, OS shutdown). Such an orphan can also be wedged in a native
 *  call, in which case it ignores SIGTERM and never answers `/api/health`,
 *  so the only reliable reclaim is SIGKILL; both of its stores (SQLite,
 *  Milvus) are crash-safe, and its own orphaned daemon is reaped by
 *  `reapOrphanDaemons` once we win the port.
 *
 *  A holder is reclaimed only when BOTH hold: its command line contains this
 *  process's own entry file (same install's server, dev or packaged), and its
 *  parent is gone (reparented to pid 1). A sibling with a live parent (e.g.
 *  `pnpm dev` in a terminal) or any foreign process is left alone — we'd
 *  rather fail with the port guidance than kill a live owner's server.
 *
 *  Returns the number of processes killed. macOS + Linux only (`lsof`/`ps`);
 *  Windows returns 0. */
export function reclaimStaleServerPort(
  port: number,
  entryPath: string,
  deps: ReclaimStaleServerPortDeps = {},
): number {
  const {
    platform = process.platform,
    selfPid = process.pid,
    listListenerPids = listListenerPidsViaLsof,
    readProcess = readProcessViaPs,
    kill = (pid: number) => process.kill(pid, 'SIGKILL'),
  } = deps;
  if (platform === 'win32') return 0;
  let reclaimed = 0;
  for (const pid of listListenerPids(port)) {
    if (pid === selfPid) continue;
    const proc = readProcess(pid);
    if (!proc) continue;
    if (!proc.command.includes(entryPath)) {
      log.warn(`port ${port} is held by pid=${pid} (${proc.command}) — not a StashBase server from this install, leaving alone`);
      continue;
    }
    if (proc.ppid !== 1) {
      log.warn(`port ${port} is held by sibling server pid=${pid} with a live parent (ppid=${proc.ppid}) — leaving alone`);
      continue;
    }
    log.warn(`reclaiming port ${port}: killing orphaned sibling server pid=${pid}`);
    try {
      kill(pid);
      reclaimed += 1;
    } catch {
      // Already gone — the port is freeing up either way.
    }
  }
  return reclaimed;
}

/** Kill orphaned stashbase daemons bound to the global store — leftovers
 *  from a previous server that died without reaping its child (kill -9,
 *  crash, Electron force-quit, or losing the `:8090` startup race). Unlike
 *  `clearStaleMilvusLock`, these may NOT hold `milvus.db` — the lock-fight
 *  loser never grabbed it, yet its mere presence lets the rightful
 *  daemon's writes vanish into the loser (the write-black-hole). So we match
 *  by command line instead of by lock holder.
 *
 *  MUST be called only AFTER winning the `:8090` arbiter and BEFORE
 *  spawning this server's own daemon: that ordering guarantees any other
 *  daemon on the global store is an orphan, never a live peer, so there's
 *  nothing to spare. Server-only — the MCP host must never run it.
 *
 *  macOS + Linux only (uses `ps`); Windows falls through silently. */
export function reapOrphanDaemons(): void {
  if (process.platform === 'win32') return;
  const storeRoot = globalVectorStoreDir();
  // `-axww` = every process, full (untruncated) command line — the daemon
  // path + `--store-root <abs>` can be long.
  const ps = spawnSync('ps', ['-axww', '-o', 'pid=,command='], { encoding: 'utf8' });
  if (ps.status !== 0 || !ps.stdout) return;
  for (const line of ps.stdout.split('\n')) {
    const m = line.trim().match(/^(\d+)\s+(.+)$/);
    if (!m) continue;
    const pid = Number(m[1]);
    const cmd = m[2];
    if (!Number.isFinite(pid) || pid <= 0 || pid === process.pid) continue;
    // Frozen binary (`…/stashbase-daemon`) or dev mode (`python …
    // stashbase_daemon.py`), scoped to OUR store via its `--store-root` arg
    // so an unrelated StashBase install's daemon is left untouched.
    const isDaemon = cmd.includes('stashbase-daemon') || cmd.includes('stashbase_daemon');
    if (!isDaemon || !cmd.includes(`--store-root ${storeRoot}`)) continue;
    log.warn(`reaping orphan daemon pid=${pid} (store=${storeRoot})`);
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already gone — fine.
    }
  }
}
