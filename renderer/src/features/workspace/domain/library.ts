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

export function displayFolderPath(folderPath: string, homeDirectory: string): string {
  if (folderPath === homeDirectory) return '~';

  const separator = folderPath.startsWith(`${homeDirectory}/`)
    ? '/'
    : folderPath.startsWith(`${homeDirectory}\\`)
      ? '\\'
      : null;

  return separator ? `~${folderPath.slice(homeDirectory.length)}` : folderPath;
}
