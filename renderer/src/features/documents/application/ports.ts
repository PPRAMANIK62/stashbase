/**
 * Everything the documents feature asks of the outside world, and every way
 * those asks are refused.
 *
 * A port is the call shape only: no transport, no wording, no retry. Each
 * capability names its own failure ladder beside its port, so a hook selects
 * recovery by `kind` and `failure-messages` owns the sentence. Adapters
 * implement these in `../infrastructure`; nothing here knows they exist.
 */
import type {
  DocumentTextSaveResult,
  DocumentTextSource,
} from '@/features/documents/domain/document';
import type { GenericFilePreview } from '@/features/documents/domain/generic-preview';
import type { MediaPreviewStatus, MediaTranscriptState } from '@/features/documents/domain/media';
import type { RecoveryDraftSummary } from '@/features/documents/domain/recovery';
import {
  featureErrorClass,
  FeatureError,
  type FeatureFailureKind,
  type TransportFailureKind,
} from '@/shared/domain/feature-error';
import type { SourceReference } from '@/shared/domain/source-reference';

export interface DocumentSourcePort {
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

export interface GenericFilePreviewPort {
  load(source: SourceReference, signal: AbortSignal): Promise<GenericFilePreview>;
}

interface SourceDocumentAsset {
  kind: 'source';
  url: string;
  version: string;
}

export interface DocxDocumentAsset {
  fallbackUrl: string;
  kind: 'docx';
  url: string;
  version: string;
}

export interface MediaDocumentAsset {
  fallbackUrl: string;
  kind: 'media';
  url: string;
  version: string;
}

export type DocumentAsset = DocxDocumentAsset | MediaDocumentAsset | SourceDocumentAsset;

export interface DocumentAssetPort {
  load(source: SourceReference, signal: AbortSignal): Promise<DocumentAsset>;
}

interface DocxPreview {
  html: string;
}

export interface DocxPreviewPort {
  load(resource: DocxDocumentAsset, signal: AbortSignal): Promise<DocxPreview>;
}

export interface MediaPort {
  cancelTranscript(source: SourceReference, signal: AbortSignal): Promise<boolean>;
  loadPreviewStatus(source: SourceReference, signal: AbortSignal): Promise<MediaPreviewStatus>;
  loadTranscript(source: SourceReference, signal: AbortSignal): Promise<MediaTranscriptState>;
  preparePreview(source: SourceReference, signal: AbortSignal): Promise<void>;
  reprocessTranscript(source: SourceReference, signal: AbortSignal): Promise<void>;
}

interface RecoveryDraftRecord extends RecoveryDraftSummary {
  content: string;
}

interface RecoveryDraftSnapshot {
  content: string;
  expectedVersion: string;
  source: SourceReference;
}

/** What one folder's journal holds, or why it holds nothing on this
 *  installation. An unavailable journal is a named state, never an empty list. */
export type { RecoveryDraftSummary };

export type RecoveryDraftListing =
  | { available: false; reason: 'no-key' }
  | { available: true; drafts: RecoveryDraftSummary[] };

/** The journal of unsaved text the server keeps outside every library folder.
 *  Best-effort protection against an unclean exit: a write is never a save. */
export interface RecoveryDraftPort {
  discard(source: SourceReference, signal: AbortSignal): Promise<void>;
  list(folderPath: string, signal: AbortSignal): Promise<RecoveryDraftListing>;
  read(source: SourceReference, signal: AbortSignal): Promise<RecoveryDraftRecord>;
  write(snapshot: RecoveryDraftSnapshot, signal: AbortSignal): Promise<{ savedAt: string }>;
}

export interface DocumentQueryScope {
  cancel(): Promise<void>;
  remove(): void;
  replaceSource(source: DocumentTextSource): void;
}

export interface DocumentWindowLifecyclePort {
  onPrepareContextRelease(handler: () => boolean | Promise<boolean>): () => void;
}

export type DocumentSourceFailureKind = FeatureFailureKind<'unsupported-encoding'>;

export type DocumentSourceError = FeatureError<'unsupported-encoding'>;
export const DocumentSourceError = featureErrorClass<'unsupported-encoding'>('DocumentSourceError');

export type GenericFilePreviewFailureKind = FeatureFailureKind<'not-generic'>;

export type GenericFilePreviewError = FeatureError<'not-generic'>;
export const GenericFilePreviewError = featureErrorClass<'not-generic'>('GenericFilePreviewError');

export type DocumentAssetFailureKind = TransportFailureKind;

export type DocumentAssetError = FeatureError;
export const DocumentAssetError = featureErrorClass('DocumentAssetError');

export type DocxPreviewFailureKind = FeatureFailureKind<'timeout'>;

export type DocxPreviewError = FeatureError<'timeout'>;
export const DocxPreviewError = featureErrorClass<'timeout'>('DocxPreviewError');

export type MediaFailureKind = TransportFailureKind;

export type MediaError = FeatureError;
export const MediaError = featureErrorClass('MediaError');

/** `disabled` is the installation having no OS-protected key, which no retry
 *  changes; `unavailable` stays the shared unreachable-server kind. */
export type RecoveryDraftFailureKind = FeatureFailureKind<'disabled' | 'not-found' | 'too-large'>;

export type RecoveryDraftError = FeatureError<'disabled' | 'not-found' | 'too-large'>;
export const RecoveryDraftError = featureErrorClass<'disabled' | 'not-found' | 'too-large'>(
  'RecoveryDraftError',
);

export type DocumentSaveFailureKind = FeatureFailureKind<'conflict'>;

/** The only failure that carries state: a conflict reports the version the
 *  server holds so the editor can offer an overwrite against a known base. */
export class DocumentSaveError extends FeatureError<'conflict'> {
  readonly currentVersion: string | null;

  constructor(
    kind: DocumentSaveFailureKind,
    message: string,
    options?: ErrorOptions & { currentVersion?: string | null | undefined },
  ) {
    super('DocumentSaveError', kind, message, options);
    this.currentVersion = options?.currentVersion ?? null;
  }
}
