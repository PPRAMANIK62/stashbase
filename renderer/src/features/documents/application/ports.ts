import type {
  DocumentTextSaveResult,
  DocumentTextSource,
} from '@/features/documents/domain/document';
import type { GenericFilePreview } from '@/features/documents/domain/generic-preview';
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

export interface GenericFilePreviewApi {
  load(source: SourceReference, signal: AbortSignal): Promise<GenericFilePreview>;
}

export interface DocumentAsset {
  url: string;
  version: string;
}

export interface DocumentAssetApi {
  load(source: SourceReference, signal: AbortSignal): Promise<DocumentAsset>;
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

export type GenericFilePreviewFailureKind =
  | 'invalid-response'
  | 'not-generic'
  | 'scope-lost'
  | 'unauthorized'
  | 'unavailable';

export class GenericFilePreviewError extends Error {
  readonly kind: GenericFilePreviewFailureKind;

  constructor(kind: GenericFilePreviewFailureKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'GenericFilePreviewError';
    this.kind = kind;
  }
}

export type DocumentAssetFailureKind =
  | 'invalid-response'
  | 'scope-lost'
  | 'unauthorized'
  | 'unavailable';

export class DocumentAssetError extends Error {
  readonly kind: DocumentAssetFailureKind;

  constructor(kind: DocumentAssetFailureKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DocumentAssetError';
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
