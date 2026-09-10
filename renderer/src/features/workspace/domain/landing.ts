/**
 * Which folder this window lands on, and which source decided it.
 *
 * Three things can name a folder for a window and they do not agree. The
 * server already holds one for this window, the desktop created the window for
 * one, and the saved session remembers one. That is a precedence, so it is
 * written here once as a total function over all three rather than as branches
 * inside the effect that acts on it.
 */

/**
 * What the desktop answered about this window, as far as the window knows.
 *
 * `pending` is not "no folder", it is "not asked yet". Collapsing the two into
 * one nullable string is exactly what let a restored session win a race it
 * should always lose, so they are separate variants and only one of them
 * carries a path.
 */
export type InitialFolderClaim =
  | { kind: 'pending' }
  | { kind: 'settled'; folderPath: string | null };

export interface FolderLandingSources {
  /** The folder the server already has open for this window. */
  activeFolder: string | null;
  initialFolder: InitialFolderClaim;
  /** The saved session's folder, already narrowed to current membership. */
  sessionFolder: string | null;
}

export type FolderLanding =
  | { source: 'pending' }
  | { source: 'none' }
  | { source: 'server'; path: string }
  | { source: 'initial'; path: string }
  | { source: 'session'; path: string };

/**
 * The precedence, five rows read top to bottom.
 *
 * The order is the race protection rather than a guard bolted beside it.
 * `pending` sits after the one source that makes the desktop's answer moot and
 * before the two that answer would preempt, so a saved session can never be
 * opened while the desktop is still being asked, and a window that already has
 * its folder never waits for an answer it would ignore. Once an initial folder
 * has been opened the server holds it, so the first row wins from then on and
 * a spent claim can never drag a reader back to where they started.
 */
export function chooseFolderLanding(sources: FolderLandingSources): FolderLanding {
  const { activeFolder, initialFolder, sessionFolder } = sources;
  if (activeFolder) return { source: 'server', path: activeFolder };
  if (initialFolder.kind === 'pending') return { source: 'pending' };
  if (initialFolder.folderPath) return { source: 'initial', path: initialFolder.folderPath };
  if (sessionFolder) return { source: 'session', path: sessionFolder };
  return { source: 'none' };
}

/** Where this landing still has to be opened, or null when it needs no
 *  request: the server's folder is already open, and nobody's is nothing. */
export function landingToOpen(landing: FolderLanding): string | null {
  return landing.source === 'initial' || landing.source === 'session' ? landing.path : null;
}
