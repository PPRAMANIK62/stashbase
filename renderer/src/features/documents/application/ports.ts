import type { DocumentTextSource } from '@/features/documents/domain/document';
import type { SourceReference } from '@/shared/domain/source-reference';

export interface DocumentSourceApi {
  load(source: SourceReference, signal: AbortSignal): Promise<DocumentTextSource>;
}

export interface DocumentQueryScope {
  cancel(): Promise<void>;
  remove(): void;
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
