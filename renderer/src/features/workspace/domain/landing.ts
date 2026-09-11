/**
 * Which folder this window lands on, and which source decided it.
 *
 * Two things can name a folder for a window and they do not agree. The server
 * already holds one for this window, or the desktop created the window for
 * one. That is a precedence, so it is written here once as a total function
 * over both rather than as branches inside the effect that acts on it.
 *
 * The saved session is deliberately not a source. It remembers what each
 * folder had expanded, selected, and open so the folder comes back the same
 * way once a reader opens it, but a window nobody named a folder for lands on
 * the welcome screen: a relaunch, a new window, and a reopened application all
 * start from the same place, and no folder is chosen on the reader's behalf.
 */

/**
 * What the desktop answered about this window, as far as the window knows.
 *
 * `pending` is not "no folder", it is "not asked yet". Collapsing the two into
 * one nullable string is what once let a restored folder win a race it should
 * always lose, so they are separate variants and only one of them carries a
 * path.
 */
export type InitialFolderClaim =
  | { kind: 'pending' }
  | { kind: 'settled'; folderPath: string | null };

export interface FolderLandingSources {
  /** The folder the server already has open for this window. */
  activeFolder: string | null;
  initialFolder: InitialFolderClaim;
}

export type FolderLanding =
  | { source: 'pending' }
  | { source: 'none' }
  | { source: 'server'; path: string }
  | { source: 'initial'; path: string };

/**
 * The precedence, four rows read top to bottom.
 *
 * The order is the race protection rather than a guard bolted beside it.
 * `pending` sits after the one source that makes the desktop's answer moot, so
 * a window that already has its folder never waits for an answer it would
 * ignore, and nothing is opened while the desktop is still being asked. Once
 * an initial folder has been opened the server holds it, so the first row wins
 * from then on and a spent claim can never drag a reader back to where they
 * started.
 */
export function chooseFolderLanding(sources: FolderLandingSources): FolderLanding {
  const { activeFolder, initialFolder } = sources;
  if (activeFolder) return { source: 'server', path: activeFolder };
  if (initialFolder.kind === 'pending') return { source: 'pending' };
  if (initialFolder.folderPath) return { source: 'initial', path: initialFolder.folderPath };
  return { source: 'none' };
}

/** Where this landing still has to be opened, or null when it needs no
 *  request: the server's folder is already open, and nobody's is nothing. */
export function landingToOpen(landing: FolderLanding): string | null {
  return landing.source === 'initial' ? landing.path : null;
}
