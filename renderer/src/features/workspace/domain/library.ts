import type { TransportFailureKind } from '@/shared/domain/feature-error';

export interface ActiveLibraryFolder {
  name: string;
  path: string;
}

interface LibraryMember {
  favorite: boolean;
  openedAt: string;
  path: string;
}

export interface LibrarySnapshot {
  activeFolder: ActiveLibraryFolder | null;
  homeDirectory: string;
  members: LibraryMember[];
}

/** The library owns no failures of its own: it meets exactly the shared
 *  transport ladder. */
export type LibraryFailureKind = TransportFailureKind;

export function folderName(folderPath: string): string {
  const withoutTrailingSeparators = folderPath.replace(/[\\/]+$/u, '');
  return withoutTrailingSeparators.split(/[\\/]/u).at(-1) ?? folderPath;
}

/** The directory a folder sits in. A list that already shows the folder's
 *  name has nothing to gain from repeating it at the end of the path. */
export function parentFolderPath(folderPath: string): string {
  const withoutTrailingSeparators = folderPath.replace(/[\\/]+$/u, '');
  const cut = Math.max(
    withoutTrailingSeparators.lastIndexOf('/'),
    withoutTrailingSeparators.lastIndexOf('\\'),
  );
  if (cut < 0) return withoutTrailingSeparators;
  return cut === 0
    ? withoutTrailingSeparators.slice(0, 1)
    : withoutTrailingSeparators.slice(0, cut);
}

export function displayFolderPath(folderPath: string, homeDirectory: string): string {
  if (folderPath === homeDirectory) return '~';

  const separator = folderPath.startsWith(`${homeDirectory}/`)
    ? '/'
    : folderPath.startsWith(`${homeDirectory}\\`)
      ? '\\'
      : null;

  return separator ? `~${folderPath.slice(homeDirectory.length)}` : folderPath;
}

/** The roots the operating system hands out for scratch work: macOS's
 *  per-user `/var/folders` tree and `/tmp`, each also reachable under
 *  `/private`, and the Windows per-user Temp directory. A folder there is a
 *  member like any other, but a list of the places a reader works leaves it
 *  out. */
const POSIX_TEMPORARY_ROOT = /^(?:\/private)?\/(?:var\/folders|tmp)\//u;
const WINDOWS_TEMPORARY_ROOT = /\\AppData\\Local\\Temp\\/iu;

export function isTemporaryFolderPath(folderPath: string): boolean {
  return POSIX_TEMPORARY_ROOT.test(folderPath) || WINDOWS_TEMPORARY_ROOT.test(folderPath);
}
