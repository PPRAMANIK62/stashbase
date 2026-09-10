import type { LibraryFailureKind, LibrarySnapshot } from '@/features/workspace/domain/library';
import type { WorkspaceSessionSnapshot } from '@/features/workspace/domain/session';
import type { WorkspaceEntry, WorkspaceListing } from '@/features/workspace/domain/tree';
import {
  featureErrorClass,
  type FeatureError,
  type FeatureFailureKind,
} from '@/shared/domain/feature-error';

type LibraryFolderPickerResult =
  | { status: 'cancelled' }
  | {
      status: 'failed';
      failure: {
        kind: LibraryFailureKind | 'fatal';
        message: string;
      };
    }
  | { status: 'selected'; folderPath: string };

export interface LibraryPort {
  load(signal: AbortSignal): Promise<LibrarySnapshot>;
  openFolder(path: string, signal: AbortSignal): Promise<LibrarySnapshot>;
  removeFolder(path: string, signal: AbortSignal): Promise<LibrarySnapshot>;
}

export interface FolderPickerOptions {
  defaultPath?: string;
}

export interface LibraryFolderPickerPort {
  chooseFolder(options?: FolderPickerOptions): Promise<LibraryFolderPickerResult>;
}

export interface WorkspaceQueryScope {
  cancel(): Promise<void>;
  remove(): void;
}

export interface WorkspaceSessionPort {
  load(): Promise<WorkspaceSessionSnapshot | null>;
  save(snapshot: WorkspaceSessionSnapshot): Promise<void>;
}

export interface LibraryLifecyclePort {
  notifyFolderRemoved(folderPath: string): Promise<void>;
  onFolderRemoved(handler: (folderPath: string) => void): () => void;
  onPrepareFolderRemoval(handler: (folderPath: string) => boolean | Promise<boolean>): () => void;
  prepareFolderRemoval(folderPath: string): Promise<boolean>;
  setActiveFolder(folderPath: string | null): Promise<void>;
}

/** The Workbench's hidden-entry visibility. One durable application-level
 *  value, so it is neither folder-scoped nor per window. The server keeps
 *  classification authority: this only asks for eligible hidden entries to be
 *  listed, and never widens what is eligible. */
export interface WorkspacePreferencesPort {
  load(signal: AbortSignal): Promise<boolean>;
  setShowHiddenFiles(next: boolean, signal: AbortSignal): Promise<boolean>;
}

export interface FilesPort {
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

interface UploadFile {
  readonly blob: Blob;
  /** Folder-relative destination path; a bare name lands at the folder root. */
  readonly name: string;
}

export interface UploadPort {
  /**
   * Imports files into `folderPath` and answers the folder-relative paths the
   * server settled on, in request order, after any collision renaming.
   *
   * A file the server refused raises on the files ladder rather than arriving
   * as a field inside a resolved result: a refusal every caller has to remember
   * to look for is one most callers do not, and this one used to reach the
   * reader as a sentence the server wrote.
   */
  upload(folderPath: string, files: readonly UploadFile[], signal: AbortSignal): Promise<string[]>;
}

/** An image the desktop found on the clipboard, offered for import. The
 *  transport's own encoding never reaches here: an offer that cannot be decoded
 *  is not an offer. */
export interface ClipboardImageOffer {
  /** Stable identity of the copied image, so one offer is settled exactly once. */
  readonly id: string;
  readonly bytes: Blob;
  /** The file name the import should land under. */
  readonly name: string;
}

export interface ClipboardCapturePort {
  /** Re-reads the clipboard, so an offer can appear without waiting for the
   *  next copy. */
  refresh(): void;
  /** Reports one offer settled — imported or dismissed — so the desktop does
   *  not offer the same image again. */
  settle(id: string): void;
  /** Calls back with each image the desktop offers; answers an unsubscribe. */
  subscribe(handler: (offer: ClipboardImageOffer) => void): () => void;
}

export type LibraryError = FeatureError;
export const LibraryError = featureErrorClass('LibraryError');

/** The saved-session bridge fails on the workspace ladder like every other
 *  workspace transport: the desktop refused the read or the write, and it
 *  names why in a sentence the reader never sees directly. */
export type WorkspaceSessionError = FeatureError;
export const WorkspaceSessionError = featureErrorClass('WorkspaceSessionError');

/** Files failures add the mutation outcomes the listing never meets: a
 *  name already taken, and a request the server refused as invalid. */
type FilesExtra = 'conflict' | 'rejected';

export type FilesFailureKind = FeatureFailureKind<FilesExtra>;

export type FilesError = FeatureError<FilesExtra>;
export const FilesError = featureErrorClass<FilesExtra>('FilesError');
