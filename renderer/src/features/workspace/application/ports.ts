import type { LibraryFailureKind, LibrarySnapshot } from '@/features/workspace/domain/library';

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
}

export interface FolderPickerOptions {
  defaultPath?: string;
}

export interface LibraryFolderPicker {
  chooseFolder(options?: FolderPickerOptions): Promise<LibraryFolderPickerResult>;
}

export class LibraryError extends Error {
  readonly kind: LibraryFailureKind;

  constructor(kind: LibraryFailureKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'LibraryError';
    this.kind = kind;
  }
}
