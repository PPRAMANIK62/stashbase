import { spawn, type ChildProcess } from 'node:child_process';
import os from 'node:os';

const KILL_GRACE_MS = 1500;
const EXTRACTOR_NICE_PRIORITY = 15;

interface ExtractorSpawnOptions {
  detached: boolean;
  stdio: ['ignore', 'pipe', 'pipe'];
  env: NodeJS.ProcessEnv;
}

export function spawnOptionsForExtractor(): ExtractorSpawnOptions {
  return {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      OMP_NUM_THREADS: process.env.STASHBASE_EXTRACTOR_THREADS ?? '1',
      OPENBLAS_NUM_THREADS: process.env.STASHBASE_EXTRACTOR_THREADS ?? '1',
      MKL_NUM_THREADS: process.env.STASHBASE_EXTRACTOR_THREADS ?? '1',
      VECLIB_MAXIMUM_THREADS: process.env.STASHBASE_EXTRACTOR_THREADS ?? '1',
      NUMEXPR_NUM_THREADS: process.env.STASHBASE_EXTRACTOR_THREADS ?? '1',
      OMP_WAIT_POLICY: 'PASSIVE',
    },
  };
}

/** PDF/OCR use a console-enabled Python sidecar for progress reporting.
 * Windows cancellation already uses taskkill /T, so detaching is unnecessary
 * there and would allocate a console window for every extractor launch. */
export function spawnOptionsForPdfOcr(
  platform: NodeJS.Platform = process.platform,
): ExtractorSpawnOptions & { windowsHide: boolean } {
  return {
    ...spawnOptionsForExtractor(),
    detached: platform !== 'win32',
    windowsHide: true,
  };
}

export function lowerExtractorPriority(proc: ChildProcess): void {
  if (!proc.pid) return;
  try {
    os.setPriority(proc.pid, EXTRACTOR_NICE_PRIORITY);
  } catch {
    // Best effort only. Thread limits above are the primary guard; priority
    // lowering is an extra courtesy to keep the Electron UI responsive.
  }
}

/** Install immediately after spawn. Completion includes pipe release and descendants,
 * even if the leader exits first. Cancellation still uses terminateExtractorTree. */
export function waitForExtractorTree(proc: ChildProcess): Promise<number | null> {
  return new Promise((resolve, reject) => {
    let closed = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    const cleanup = () => {
      clearInterval(poll);
      proc.off('error', fail);
      proc.off('exit', onExit);
      proc.off('close', onClose);
    };
    const inspect = () => {
      if (!closed || (process.platform !== 'win32' && extractorGroupExists(proc))) return;
      cleanup();
      resolve(proc.exitCode);
    };
    const fail = (error: Error) => { cleanup(); reject(error); };
    const onExit = () => {
      if (process.platform !== 'win32' && extractorGroupExists(proc)) terminateExtractorTree(proc);
      poll = setInterval(inspect, 25);
    };
    const onClose = () => { closed = true; inspect(); };
    proc.once('error', fail);
    proc.once('exit', onExit);
    proc.once('close', onClose);
  });
}

export function terminateExtractorTree(proc: ChildProcess): void {
  if (process.platform === 'win32') {
    terminateWindowsTree(proc);
    return;
  }
  sendSignal(proc, 'SIGTERM');
  setTimeout(() => {
    // The group can outlive its leader while descendants still own pipes.
    if (extractorGroupExists(proc) || (proc.exitCode == null && proc.signalCode == null)) {
      sendSignal(proc, 'SIGKILL');
    }
  }, KILL_GRACE_MS).unref();
}

/** Node cannot address Windows process groups with a negative PID. `taskkill`
 * is the OS-provided tree primitive; `/T /F` makes cancellation a real tree
 * kill before the scheduler observes the extractor's close event. */
function terminateWindowsTree(proc: ChildProcess): void {
  if (!proc.pid) return;
  const fallback = () => {
    if (proc.exitCode == null && proc.signalCode == null) {
      try { proc.kill(); } catch { /* already gone */ }
    }
  };
  try {
    const killer = spawn('taskkill.exe', ['/PID', String(proc.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    killer.once('error', fallback);
    killer.once('close', (code) => {
      if (code !== 0) fallback();
    });
  } catch {
    fallback();
  }
}

function extractorGroupExists(proc: ChildProcess): boolean {
  if (!proc.pid) return false;
  try {
    process.kill(-proc.pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function sendSignal(proc: ChildProcess, signal: NodeJS.Signals): void {
  if (!proc.pid) return;
  try {
    process.kill(-proc.pid, signal);
  } catch {
    if (proc.exitCode == null && proc.signalCode == null) {
      try { proc.kill(signal); } catch { /* already gone */ }
    }
  }
}
