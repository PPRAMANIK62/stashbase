export interface ActiveLibraryFolder {
  name: string;
  path: string;
}

export interface LibraryMember {
  favorite: boolean;
  openedAt: string;
  path: string;
}

export interface LibrarySnapshot {
  activeFolder: ActiveLibraryFolder | null;
  homeDirectory: string;
  members: LibraryMember[];
}

export type LibraryFailureKind = 'invalid-response' | 'scope-lost' | 'unauthorized' | 'unavailable';

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
