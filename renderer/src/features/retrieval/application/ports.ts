import type {
  ExactSearchRequest,
  ExactSearchResult,
} from '@/features/retrieval/domain/exact-search';
import type {
  SemanticSearchRequest,
  SemanticSearchResult,
} from '@/features/retrieval/domain/semantic-search';

export interface ExactSearchApi {
  search(request: ExactSearchRequest, signal: AbortSignal): Promise<ExactSearchResult>;
}

export type ExactSearchFailureKind = 'invalid-response' | 'unavailable';

export class ExactSearchError extends Error {
  readonly kind: ExactSearchFailureKind;

  constructor(kind: ExactSearchFailureKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ExactSearchError';
    this.kind = kind;
  }
}

export interface SemanticSearchApi {
  search(request: SemanticSearchRequest, signal: AbortSignal): Promise<SemanticSearchResult>;
}

export type SemanticSearchFailureKind =
  | 'invalid-response'
  | 'not-set-up'
  | 'quota-exhausted'
  | 'unavailable';

export class SemanticSearchError extends Error {
  readonly kind: SemanticSearchFailureKind;

  constructor(kind: SemanticSearchFailureKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SemanticSearchError';
    this.kind = kind;
  }
}

export type IndexDecision = 'start' | 'defer';

/** Folder-explicit AI Index decisions and index-warning recovery. */
export interface IndexDecisionApi {
  decide(folderPath: string, decision: IndexDecision, signal: AbortSignal): Promise<void>;
  dismissWarning(folderPath: string, signal: AbortSignal): Promise<void>;
  resync(folderPath: string, signal: AbortSignal): Promise<void>;
}

export class IndexDecisionError extends Error {
  readonly kind: 'invalid-response' | 'unavailable';

  constructor(kind: 'invalid-response' | 'unavailable', message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'IndexDecisionError';
    this.kind = kind;
  }
}
