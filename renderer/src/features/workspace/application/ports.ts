import type { LibraryFailureKind, LibrarySnapshot } from '@/features/workspace/domain/library';
import type { WorkspaceSessionSnapshot } from '@/features/workspace/domain/session';
import type { WorkspaceEntry, WorkspaceListing } from '@/features/workspace/domain/tree';

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
  /** Creates one file or folder under `parentPath` and returns the settled
   *  path: the server may complete a file's extension. */
  createEntry(
    folderPath: string,
    kind: WorkspaceEntry['kind'],
    parentPath: string,
    name: string,
    signal: AbortSignal,
  ): Promise<{ path: string }>;
  /** Gives an entry a new leaf name in its own parent and returns the
   *  settled path. */
  renameEntry(
    folderPath: string,
    entry: WorkspaceEntry,
    name: string,
    signal: AbortSignal,
  ): Promise<{ path: string }>;
  /** Deletes a file, or a folder with everything inside it, from disk. */
  deleteEntry(folderPath: string, entry: WorkspaceEntry, signal: AbortSignal): Promise<void>;
}

export interface UploadFile {
  readonly blob: Blob;
  /** Folder-relative destination path; a bare name lands at the folder root. */
  readonly name: string;
}

export interface UploadOutcome {
  readonly error?: string;
  /** Folder-relative path the server published, after any collision renaming. */
  readonly file: string;
}

export interface UploadApi {
  upload(
    folderPath: string,
    files: readonly UploadFile[],
    signal: AbortSignal,
  ): Promise<UploadOutcome[]>;
}

export class LibraryError extends Error {
  readonly kind: LibraryFailureKind;

  constructor(kind: LibraryFailureKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'LibraryError';
    this.kind = kind;
  }
}

/** Files failures add the mutation outcomes the listing never meets: a
 *  name already taken, and a request the server refused as invalid. */
export type FilesFailureKind = LibraryFailureKind | 'conflict' | 'rejected';

export class FilesError extends Error {
  readonly kind: FilesFailureKind;

  constructor(kind: FilesFailureKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FilesError';
    this.kind = kind;
  }
}
