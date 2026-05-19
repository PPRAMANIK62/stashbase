/**
 * MFS sidecar daemon manager.
 *
 * Spawns `python/stashbase_daemon.py` once per server process, talks to
 * it over stdin/stdout in line-delimited JSON, and matches replies back
 * to requests by an auto-incrementing id. Auto-respawns if the daemon
 * dies (in-flight requests get rejected with the exit info).
 *
 * Python lives in `<project>/python/.venv/bin/python` after the user
 * runs `pnpm setup:python`. In packaged Electron a portable Python
 * runtime is bundled via `extraResources` and the path is overridden
 * via `STASHBASE_PYTHON` env var (see `electron/main.cjs`).
 */
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { logger } from './log.ts';

const log = logger('mfs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = process.env.STASHBASE_APP_ROOT
  ? path.resolve(process.env.STASHBASE_APP_ROOT)
  : path.resolve(__dirname, '..');
const RESOURCES_ROOT = process.env.STASHBASE_RESOURCES_PATH
  ? path.resolve(process.env.STASHBASE_RESOURCES_PATH)
  : PROJECT_ROOT;

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

export interface DaemonEvents {
  ready: { model: string; dim: number };
  starting: { pid: number };
  error: { phase: string; error: string };
}

/** Singleton-ish handle. Use `getDaemon()` to access. */
class MfsDaemon extends EventEmitter {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private readyP: Promise<void> | null = null;
  /** Bumps every time we (re)spawn the Python process. Callers that
   *  cache "I already configured this daemon" state can compare against
   *  the value at config time — if it changed, re-issue the config op. */
  private generation = 0;

  /** Spawn (idempotent) and resolve once the daemon emits `ready`. */
  async ensureReady(): Promise<void> {
    if (this.readyP) return this.readyP;
    this.readyP = this.spawnAndWait();
    return this.readyP;
  }

  /** Opaque token identifying the current Python process. Increments on
   *  every respawn. Callers should treat as a black-box equality check. */
  currentGeneration(): number {
    return this.generation;
  }

  private spawnAndWait(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const daemon = resolveDaemonCommand();
      log.info(`spawning ${daemon.command} ${daemon.args.join(' ')}`);
      const proc = spawn(daemon.command, daemon.args, {
        cwd: daemon.cwd,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          // Milvus Lite spins up its own gRPC server in-process; pymilvus
          // client's default keepalive ping (every 10s) is too aggressive
          // for that loopback server and trips a `ENHANCE_YOUR_CALM`
          // GOAWAY ~every minute. The reconnect is transparent — only
          // the log is noisy. Drop gRPC's INFO chatter to ERROR so real
          // failures still surface but the keepalive spam goes away.
          // (`NONE` would also silence genuine errors — too aggressive.)
          GRPC_VERBOSITY: process.env.GRPC_VERBOSITY ?? 'ERROR',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this.proc = proc;
      this.generation += 1;

      const lines = readline.createInterface({ input: proc.stdout });
      lines.on('line', (line) => this.onLine(line, resolve));

      // Surface daemon stderr to the Electron / dev terminal verbatim;
      // Python `traceback.format_exc()` lands here when an op crashes.
      proc.stderr.on('data', (chunk: Buffer) => {
        process.stderr.write(`[mfs/py] ${chunk.toString()}`);
      });

      proc.on('exit', (code, signal) => {
        const err = new Error(
          `MFS daemon exited (code=${code}, signal=${signal ?? 'null'})`,
        );
        log.warn(`${err.message}`);
        for (const slot of this.pending.values()) slot.reject(err);
        this.pending.clear();
        this.proc = null;
        this.readyP = null;
        // If we never got `ready`, surface the failure to the caller.
        reject(err);
      });
    });
  }

  private onLine(line: string, readyResolve: () => void): void {
    let msg: any;
    try { msg = JSON.parse(line); } catch {
      log.warn(`non-JSON line from daemon: ${line}`);
      return;
    }
    if ('event' in msg) {
      // Forward typed events under a namespaced prefix. Node's
      // EventEmitter treats a bare `'error'` event as fatal if there
      // are no listeners — and our well-intentioned `{event:"error"}`
      // payload from the daemon was tripping that. Namespacing avoids
      // the collision and still lets callers subscribe if they want.
      this.emit(`daemon:${msg.event}`, msg);
      if (msg.event === 'ready') {
        log.info(`daemon ready: model=${msg.model} dim=${msg.dim}`);
        readyResolve();
      } else if (msg.event === 'starting') {
        log.info(`daemon starting, pid=${msg.pid}`);
      } else if (msg.event === 'error') {
        // A startup-phase error from Python (e.g. ImportError on
        // onnxruntime) means the daemon is about to exit. Surface it
        // with an actionable hint and reject the readyP so any caller
        // awaiting first use gets a clean error instead of hanging.
        const hint = /No module named/i.test(msg.error ?? '')
          ? '\n  → Looks like the Python sidecar deps aren\'t installed. Run: pnpm setup:python'
          : '';
        log.warn(`daemon error in ${msg.phase}: ${msg.error}${hint}`);
      }
      return;
    }
    const id = msg.id;
    const slot = this.pending.get(id);
    if (!slot) {
      log.warn(`reply with unknown id=${id}`);
      return;
    }
    this.pending.delete(id);
    if (msg.ok) slot.resolve(msg.result);
    else slot.reject(new Error(msg.error ?? 'daemon error'));
  }

  /** Send one op and await the matching reply. Awaits `ensureReady` first. */
  async call<T = unknown>(op: string, args: Record<string, unknown>): Promise<T> {
    await this.ensureReady();
    if (!this.proc) throw new Error('MFS daemon not running');
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.proc!.stdin.write(JSON.stringify({ id, op, args }) + '\n');
    });
  }

  async close(): Promise<void> {
    if (!this.proc) return;
    const proc = this.proc;
    this.proc = null;
    this.readyP = null;
    // Reject any in-flight calls so awaiters don't hang forever once
    // the process is gone. They'd otherwise sit pending until next
    // tick, then surface as misleading timeouts.
    const inflight = [...this.pending.values()];
    this.pending.clear();
    const closeErr = new Error('MFS daemon closing');
    for (const slot of inflight) slot.reject(closeErr);
    proc.stdin.end();
    // Escalation ladder: graceful EOF → SIGTERM → SIGKILL. The Python
    // signal handler can't run while the main thread is blocked inside
    // a C extension (Milvus Lite, ONNX), so a stuck daemon won't die
    // on SIGTERM. SIGKILL can't be caught — guarantees the slot frees
    // up before our caller (e.g. dropStore) proceeds to wipe the DB
    // file that the daemon would otherwise still hold via flock.
    await new Promise<void>((resolve) => {
      let exited = false;
      proc.once('exit', () => { exited = true; resolve(); });
      setTimeout(() => {
        if (exited) return;
        try { proc.kill('SIGTERM'); } catch { /* already gone */ }
      }, 1500);
      setTimeout(() => {
        if (exited) return;
        try { proc.kill('SIGKILL'); } catch { /* already gone */ }
        // Hard ceiling: if even SIGKILL didn't surface an exit event
        // within another 500 ms, give up waiting. The kernel reaps
        // the process eventually; we just don't have to block here.
        setTimeout(() => { if (!exited) resolve(); }, 500);
      }, 3000);
    });
  }
}

/** Locate the Python binary. Precedence:
 *   1. ``STASHBASE_PYTHON`` env (used by packaged Electron to point at the
 *      bundled portable runtime under ``process.resourcesPath``).
 *   2. ``python/.venv/bin/python`` populated by ``pnpm setup:python``.
 *   3. system ``python3`` — last resort, gives a clearer error if mfs-cli
 *      isn't installed than just failing to spawn. */
function resolvePythonBin(): string {
  const bin = (() => {
    if (process.env.STASHBASE_PYTHON) return process.env.STASHBASE_PYTHON;
    const packagedRuntime = path.join(RESOURCES_ROOT, 'python', 'runtime', 'bin', 'python');
    if (existsSync(packagedRuntime)) return packagedRuntime;
    const packagedVenv = path.join(RESOURCES_ROOT, 'python', '.venv', 'bin', 'python');
    if (existsSync(packagedVenv)) return packagedVenv;
    const venvBin = path.join(PROJECT_ROOT, 'python', '.venv', 'bin', 'python');
    if (existsSync(venvBin)) return venvBin;
    log.warn('python/.venv not found, falling back to system `python3`');
    return 'python3';
  })();

  // Probe imports up-front. Catches "user forgot to run setup:python"
  // (or system python3 lacks deps) here, with an actionable message —
  // way better than letting the daemon spawn and emit a JSON error
  // event seconds later from a cryptic ImportError.
  const probe = spawnSync(bin, ['-c', 'import mfs, onnxruntime, tokenizers, numpy'], {
    encoding: 'utf8',
  });
  if (probe.status !== 0) {
    const lastErrLine = (probe.stderr || '').trim().split('\n').pop() ?? '';
    throw new Error(
      `Python sidecar deps missing at ${bin}\n` +
        `  ${lastErrLine}\n` +
        `  → fix: pnpm setup:python`,
    );
  }
  return bin;
}

function resolveDaemonCommand(): { command: string; args: string[]; cwd: string } {
  const binary = resolveDaemonBinary();
  if (binary) {
    return { command: binary, args: [], cwd: path.dirname(binary) };
  }
  const pythonBin = resolvePythonBin();
  const script = resolvePythonDaemonScript();
  return { command: pythonBin, args: ['-u', script], cwd: PROJECT_ROOT };
}

function resolveDaemonBinary(): string | null {
  const candidates = [
    process.env.STASHBASE_DAEMON_BIN,
    path.join(RESOURCES_ROOT, 'python', 'sidecar', 'stashbase-daemon'),
    path.join(PROJECT_ROOT, 'python', 'sidecar', 'stashbase-daemon'),
  ].filter(Boolean) as string[];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function resolvePythonDaemonScript(): string {
  const candidates = [
    path.join(RESOURCES_ROOT, 'python', 'stashbase_daemon.py'),
    path.join(PROJECT_ROOT, 'python', 'stashbase_daemon.py'),
  ];
  const script = candidates.find((candidate) => existsSync(candidate));
  if (!script) {
    throw new Error(`Python sidecar script not found. Looked in: ${candidates.join(', ')}`);
  }
  return script;
}

let singleton: MfsDaemon | null = null;
export function getDaemon(): MfsDaemon {
  if (!singleton) singleton = new MfsDaemon();
  return singleton;
}
