export {
  ExactSearchError,
  IndexDecisionError,
  SemanticSearchError,
  type ExactSearchApi,
  type ExactSearchFailureKind,
  type IndexDecision,
  type IndexDecisionApi,
  type SemanticSearchApi,
  type SemanticSearchFailureKind,
} from './application/ports';
export {
  exactSearchFileId,
  exactSearchNavigationIntent,
  exactSearchOccurrences,
  exactSearchSegments,
  type ExactSearchFile,
  type ExactSearchMatch,
  type ExactSearchNavigationIntent,
  type ExactSearchOccurrence,
  type ExactSearchRequest,
  type ExactSearchResult,
} from './domain/exact-search';
export {
  type QuickOpenAction,
  type QuickOpenNavigationIntent,
  type QuickOpenRetrievalAccess,
  type QuickOpenSource,
} from './domain/quick-open';
export {
  preparationReadinessLine,
  semanticReadiness,
  type PreparationCounts,
  type PreparationReadinessLine,
  type SemanticReadiness,
} from './domain/semantic-readiness';
export {
  groupSemanticHits,
  semanticNavigationIntent,
  type SearchScope,
  type SemanticHit,
  type SemanticSearchRequest,
  type SemanticSearchResult,
} from './domain/semantic-search';
export { createExactSearchApi } from './infrastructure/exact-search-api';
export { createIndexDecisionApi } from './infrastructure/index-decision-api';
export { createSemanticSearchApi } from './infrastructure/semantic-search-api';
export { LibrarySearch, type LibrarySearchProps, type SearchMode } from './ui/library-search';
export { QuickOpen } from './ui/quick-open';
export type { QuickOpenProps, QuickOpenStatus } from './ui/quick-open-types';
