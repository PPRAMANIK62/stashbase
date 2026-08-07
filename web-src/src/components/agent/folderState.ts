/** Pure state for the composer's session-folder pill (the Cursor-style
 * folder picker). Kept free of React so default/lock/follow-window
 * semantics stay covered without a browser harness, mirroring
 * `modelState.ts`.
 *
 * Semantics:
 * - A tab with no started session follows the window's current folder
 *   until the user explicitly picks another library folder.
 * - Once the session has content (or is resumed), the binding is fixed:
 *   the pill keeps showing the folder the session connected with, and a
 *   later window-folder switch must not rebind it.
 */

export interface LibraryFolderOption {
  path: string;
  favorite?: boolean;
}

/** Menu entries for the picker: the same membership list the sidebar
 * shows (`state.recent`), favorites pinned first, both groups keeping the
 * server's recents order. The current window folder is ensured so the
 * default choice is always present even before recents load. */
export function folderMenuEntries(
  recent: readonly { path: string; favorite?: boolean }[],
  windowFolder: string,
): LibraryFolderOption[] {
  const favorites = recent.filter((entry) => entry.favorite);
  const others = recent.filter((entry) => !entry.favorite);
  const ordered: LibraryFolderOption[] = [...favorites, ...others]
    .map(({ path, favorite }) => ({ path, ...(favorite ? { favorite: true } : {}) }));
  if (windowFolder && !ordered.some((entry) => entry.path === windowFolder)) {
    ordered.unshift({ path: windowFolder });
  }
  return ordered;
}

/** The folder a NEW session would bind: the explicit pick, else the
 * window's current folder — so an unbound tab follows a sidebar switch.
 * An explicit pick that has left library membership (folder removed) is
 * ignored so the picker cannot bind a dead folder. */
export function nextSessionFolder(
  picked: string | undefined,
  windowFolder: string,
  memberPaths: readonly string[],
): string {
  if (picked && memberPaths.includes(picked)) return picked;
  return windowFolder;
}

/** The folder the pill displays: the live session's binding once one is
 * connected, else the folder the next session would use. */
export function folderPillFolder(options: {
  connectedFolder: string | null;
  picked: string | undefined;
  windowFolder: string;
  memberPaths: readonly string[];
}): string {
  return options.connectedFolder
    ?? nextSessionFolder(options.picked, options.windowFolder, options.memberPaths);
}

/** Locked exactly like the model menu — a transcript (including a resumed
 * one) or an active turn means the conversation is bound to its folder. */
export function folderMenuLocked(hasTranscript: boolean, turnActive: boolean, resumedSession: boolean): boolean {
  return hasTranscript || turnActive || resumedSession;
}

/** No library folders → no pill; the composer needs a folder to exist. */
export function folderMenuVisible(entries: readonly LibraryFolderOption[]): boolean {
  return entries.length > 0;
}

export function folderDisplayName(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments.pop() || path;
}

/** Shorten an absolute path for menu detail text: `/Users/foo/Notes` →
 * `~/Notes` when it lives under the user's home dir. */
export function shortenFolderPath(abs: string, homeDir: string): string {
  if (!homeDir) return abs;
  if (abs === homeDir) return '~';
  if (abs.startsWith(homeDir + '/')) return '~/' + abs.slice(homeDir.length + 1);
  return abs;
}

export function folderPillAriaLabel(name: string, locked: boolean): string {
  return locked
    ? `Session folder: ${name} — set for this conversation`
    : `Session folder: ${name}`;
}
