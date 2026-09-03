import type {
  DocumentTextSaveResult,
  DocumentTextSource,
} from '@/features/documents/domain/document';
import type { SourceReference } from '@/shared/domain/source-reference';

export interface DocumentSourceApi {
  load(source: SourceReference, signal: AbortSignal): Promise<DocumentTextSource>;
  overwrite(
    source: SourceReference,
    input: { content: string },
    signal: AbortSignal,
  ): Promise<DocumentTextSaveResult>;
  save(
    source: SourceReference,
    input: { baseVersion: string; content: string },
    signal: AbortSignal,
  ): Promise<DocumentTextSaveResult>;
}

export interface DocumentQueryScope {
  cancel(): Promise<void>;
  remove(): void;
  replaceSource(source: DocumentTextSource): void;
}

export interface DocumentWindowLifecycle {
  onPrepareContextRelease(handler: () => boolean | Promise<boolean>): () => void;
}

export type DocumentSourceFailureKind =
  | 'invalid-response'
  | 'scope-lost'
  | 'unauthorized'
  | 'unavailable'
  | 'unsupported-encoding';

export class DocumentSourceError extends Error {
  readonly kind: DocumentSourceFailureKind;

  constructor(kind: DocumentSourceFailureKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DocumentSourceError';
    this.kind = kind;
  }
}

export type DocumentSaveFailureKind =
  | 'conflict'
  | 'invalid-response'
  | 'scope-lost'
  | 'unauthorized'
  | 'unavailable';

export class DocumentSaveError extends Error {
  readonly currentVersion: string | null;
  readonly kind: DocumentSaveFailureKind;

  constructor(
    kind: DocumentSaveFailureKind,
    message: string,
    options?: ErrorOptions & { currentVersion?: string | null },
  ) {
    super(message, options);
    this.name = 'DocumentSaveError';
    this.currentVersion = options?.currentVersion ?? null;
    this.kind = kind;
  }
}
