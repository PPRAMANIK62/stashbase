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
import type { RevisionOrigin } from '@/features/documents/domain/revision';
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

export interface DocumentQueryScope {
  cancel(): Promise<void>;
  remove(): void;
  replaceSource(source: DocumentTextSource): void;
}

export interface DocumentWindowLifecyclePort {
  onPrepareContextRelease(handler: () => boolean | Promise<boolean>): () => void;
}

export interface DocumentRevisionProposal {
  readonly id: string;
  readonly baseVersion: string;
  readonly content: string;
  readonly createdAt: number;
  readonly origin: RevisionOrigin;
  readonly source: SourceReference;
}

export interface DrainedRevisions {
  readonly proposals: readonly DocumentRevisionProposal[];
  readonly unresolved: readonly string[];
}

export interface DocumentRevisionsPort {
  drain(folderPath: string, signal: AbortSignal): Promise<DrainedRevisions>;
}

/** Hemmingway-1's plain rewrite of a selection: Markdown in, Markdown out.
 *  The rewrite never touches a file; the caller turns it into a revision. */
export interface DocumentHumanizePort {
  humanize(input: { text: string }, signal: AbortSignal): Promise<{ text: string }>;
}

type HumanizeExtra = 'busy' | 'cut-off' | 'too-long';

/** `busy` and `too-long` are the reader's to act on: wait, or select less.
 *  `cut-off` is a rewrite the service ended at its length limit, which the
 *  host refused rather than offering most of a paragraph. */
export type DocumentHumanizeFailureKind = FeatureFailureKind<HumanizeExtra>;
export type DocumentHumanizeError = FeatureError<HumanizeExtra>;
export const DocumentHumanizeError = featureErrorClass<HumanizeExtra>('DocumentHumanizeError');

export type DocumentRevisionsFailureKind = TransportFailureKind;
export type DocumentRevisionsError = FeatureError;
export const DocumentRevisionsError = featureErrorClass('DocumentRevisionsError');

export type DocumentSourceFailureKind = FeatureFailureKind<'unsupported-encoding' | 'missing'>;

export type DocumentSourceError = FeatureError<'unsupported-encoding' | 'missing'>;
export const DocumentSourceError = featureErrorClass<'unsupported-encoding' | 'missing'>(
  'DocumentSourceError',
);

export type GenericFilePreviewFailureKind = FeatureFailureKind<'not-generic' | 'missing'>;

export type GenericFilePreviewError = FeatureError<'not-generic' | 'missing'>;
export const GenericFilePreviewError = featureErrorClass<'not-generic' | 'missing'>(
  'GenericFilePreviewError',
);

export type DocumentAssetFailureKind = FeatureFailureKind<'missing'>;

export type DocumentAssetError = FeatureError<'missing'>;
export const DocumentAssetError = featureErrorClass<'missing'>('DocumentAssetError');

export type DocxPreviewFailureKind = FeatureFailureKind<'timeout'>;

export type DocxPreviewError = FeatureError<'timeout'>;
export const DocxPreviewError = featureErrorClass<'timeout'>('DocxPreviewError');

export type DocumentSaveFailureKind = FeatureFailureKind<'conflict' | 'missing'>;

/** The only failure that carries state: a conflict reports the version the
 *  server holds so the editor can offer an overwrite against a known base. */
export class DocumentSaveError extends FeatureError<'conflict' | 'missing'> {
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
