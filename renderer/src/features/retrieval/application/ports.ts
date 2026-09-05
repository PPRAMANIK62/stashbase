import type {
  ExactSearchRequest,
  ExactSearchResult,
} from '@/features/retrieval/domain/exact-search';

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
