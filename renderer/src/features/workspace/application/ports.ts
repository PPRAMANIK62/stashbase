import type { LibraryFailureKind, LibrarySnapshot } from '@/features/workspace/domain/library';
import type { WorkspaceSessionSnapshot } from '@/features/workspace/domain/session';
import type { WorkspaceListing } from '@/features/workspace/domain/tree';

export type LibraryFolderPickerResult =
  | { status: 'cancelled' }
  | {
      status: 'failed';
      failure: {
        kind: LibraryFailureKind | 'fatal';
        message: string;
      };
    }
  | { status: 'selected'; folderPath: string };

export interface LibraryApi {
  load(signal: AbortSignal): Promise<LibrarySnapshot>;
  openFolder(path: string, signal: AbortSignal): Promise<LibrarySnapshot>;
  removeFolder(path: string, signal: AbortSignal): Promise<LibrarySnapshot>;
}

export interface FolderPickerOptions {
  defaultPath?: string;
}

export interface LibraryFolderPicker {
  chooseFolder(options?: FolderPickerOptions): Promise<LibraryFolderPickerResult>;
}

export interface WorkspaceQueryScope {
  cancel(): Promise<void>;
  remove(): void;
}

export interface WorkspaceSessionPersistence {
  load(): Promise<WorkspaceSessionSnapshot | null>;
  save(snapshot: WorkspaceSessionSnapshot): Promise<void>;
}

export interface LibraryLifecycle {
  notifyFolderRemoved(folderPath: string): Promise<void>;
  onFolderRemoved(handler: (folderPath: string) => void): () => void;
  onPrepareFolderRemoval(handler: (folderPath: string) => boolean | Promise<boolean>): () => void;
  prepareFolderRemoval(folderPath: string): Promise<boolean>;
  setActiveFolder(folderPath: string | null): Promise<void>;
}

export interface FilesApi {
  load(folderPath: string, signal: AbortSignal): Promise<WorkspaceListing>;
  reveal(folderPath: string, entryPath: string, signal: AbortSignal): Promise<void>;
}

export class LibraryError extends Error {
  readonly kind: LibraryFailureKind;

  constructor(kind: LibraryFailureKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'LibraryError';
    this.kind = kind;
  }
}

export class FilesError extends Error {
  readonly kind: LibraryFailureKind;

  constructor(kind: LibraryFailureKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FilesError';
    this.kind = kind;
  }
}
