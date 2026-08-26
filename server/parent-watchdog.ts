/**
 * Self-termination for an Electron-owned server whose parent died without
 * completing its kill ladder (crash, force quit, OS shutdown, SIGKILL).
 *
 * Electron's `will-quit` ladder (loopback shutdown → SIGTERM → SIGKILL) only
 * exists while Electron itself is alive. When the owner dies uncleanly the
 * server — and its Python daemon child holding the Milvus flock — would
 * otherwise run until the next launch reclaims the port. POSIX reparents an
 * orphan (its ppid changes to init/launchd or a subreaper), so a ppid change
 * is a reliable "my owner is gone" signal that needs no foreign-pid polling.
 *
 * POSIX-only, matching the orphan reapers in `stale-lock.ts`; on Windows the
 * watchdog never starts and the returned stopper is a no-op.
 */

export interface ParentWatchdogOptions {
  onOrphaned: () => void;
  intervalMs?: number;
  platform?: NodeJS.Platform;
  getPpid?: () => number;
}

/** Start polling for reparenting. Returns a stopper. Fires `onOrphaned` at
 *  most once; the timer is unref'd so it never keeps the process alive. */
export function startParentWatchdog({
  onOrphaned,
  intervalMs = 15_000,
  platform = process.platform,
  getPpid = () => process.ppid,
}: ParentWatchdogOptions): () => void {
  if (platform === 'win32') return () => {};
  const initialPpid = getPpid();
  const timer = setInterval(() => {
    if (getPpid() === initialPpid) return;
    clearInterval(timer);
    onOrphaned();
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
