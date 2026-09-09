import type { FolderIndexStatus } from '@/shared/domain/folder-index-status';
import type { SourceReference } from '@/shared/domain/source-reference';

export interface PreparationStatusApi {
  load(folderPath: string, signal: AbortSignal): Promise<FolderIndexStatus>;
}

export interface PreparationReprocessOptions {
  readonly language?: string;
}

export interface PreparationControlApi {
  /** Queue or promote DOCX and media preparation on open. Never destructive. */
  prepare(source: SourceReference, signal: AbortSignal): Promise<void>;
  reprocess(
    source: SourceReference,
    options: PreparationReprocessOptions,
    signal: AbortSignal,
  ): Promise<'conversion' | 'index'>;
  cancel(source: SourceReference, signal: AbortSignal): Promise<boolean>;
}

export type PreparationFailureKind =
  | 'blocked'
  | 'invalid-response'
  | 'scope-lost'
  | 'unavailable'
  | 'unsupported';

export class PreparationError extends Error {
  readonly kind: PreparationFailureKind;

  constructor(kind: PreparationFailureKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PreparationError';
    this.kind = kind;
  }
}
