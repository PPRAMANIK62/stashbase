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

export type LibraryFailureKind = 'invalid-response' | 'unauthorized' | 'unavailable';
