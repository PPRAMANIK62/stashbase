import type { SemanticFailureExtra } from '@/features/retrieval/application/failure-messages';
import type {
  ExactSearchRequest,
  ExactSearchResult,
} from '@/features/retrieval/domain/exact-search';
import type {
  SemanticSearchRequest,
  SemanticSearchResult,
} from '@/features/retrieval/domain/semantic-search';
import { featureErrorClass, type FeatureError } from '@/shared/domain/feature-error';

export interface ExactSearchPort {
  search(request: ExactSearchRequest, signal: AbortSignal): Promise<ExactSearchResult>;
}

export type ExactSearchError = FeatureError;
export const ExactSearchError = featureErrorClass('ExactSearchError');

export interface SemanticSearchPort {
  search(request: SemanticSearchRequest, signal: AbortSignal): Promise<SemanticSearchResult>;
}

export type SemanticSearchError = FeatureError<SemanticFailureExtra>;
export const SemanticSearchError = featureErrorClass<SemanticFailureExtra>('SemanticSearchError');

type IndexDecision = 'start' | 'defer';

/** Folder-explicit AI Index decisions and index-warning recovery. */
export interface IndexDecisionPort {
  decide(folderPath: string, decision: IndexDecision, signal: AbortSignal): Promise<void>;
  dismissWarning(folderPath: string, signal: AbortSignal): Promise<void>;
  resync(folderPath: string, signal: AbortSignal): Promise<void>;
}

export type IndexDecisionError = FeatureError;
export const IndexDecisionError = featureErrorClass('IndexDecisionError');
