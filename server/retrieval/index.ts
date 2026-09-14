/**
 * Source-oriented retrieval.
 *
 * Keyword and semantic implementations stay private adapters. Callers receive
 * one flat evidence model keyed by the visible, absolute source path; prepared
 * representations never cross this seam.
 */
import { isEmbeddingAvailable } from '../embedding-availability.ts';
import { searchExtensionsForTypes } from '../format.ts';
import type { ExactSearchOptions, SearchHit } from '../indexer.ts';
import { indexer } from '../state.ts';
import type { SearchMode, SearchTypeCategory } from '../../shared/search-types.ts';
import { semanticEvidence } from './semantic.ts';
import { visibleKeywordEvidence } from './keyword.ts';

export { keywordFilesFromEvidence, searchHitsFromEvidence, type SourceEvidence, type SourceLocator } from './evidence.ts';

export type RetrievalMode = SearchMode;
export type RetrievalAvailability =
  | { state: 'ready' }
  | { state: 'partial'; reason: 'truncated' }
  | { state: 'unavailable'; reason: 'embedding-key-required' };

export interface RetrievalQuery {
  mode: RetrievalMode;
  query: string;
  folderRoot: string;
  pathPrefix?: string;
  types?: readonly SearchTypeCategory[];
  topK?: number;
  caseStrict?: boolean;
  wholeWord?: boolean;
}

export interface RetrievalResult {
  evidence: import('./evidence.ts').SourceEvidence[];
  availability: RetrievalAvailability;
  truncated: boolean;
}

export interface RetrievalDependencies {
  hasEmbeddingKey: () => boolean;
  embeddingUnavailableReason: () => 'embedding-key-required';
  vectorSearch: (query: string, topK: number, folderRoot: string, pathPrefix?: string, extensions?: string[]) => Promise<SearchHit[]>;
  exactSearch: (query: string, folderRoot: string, opts: ExactSearchOptions) => Promise<{ files: import('../search-display.ts').KeywordHitFile[]; truncated: boolean }>;
}

const productionDependencies: RetrievalDependencies = {
  hasEmbeddingKey: isEmbeddingAvailable,
  embeddingUnavailableReason: () => 'embedding-key-required',
  vectorSearch: (query, topK, folderRoot, pathPrefix, extensions) =>
    indexer.search(query, topK, folderRoot, pathPrefix, extensions),
  exactSearch: (query, folderRoot, options) => indexer.grep(query, folderRoot, options),
};

/** The retrieval module interface shared by UI routes and library/MCP operations. */
export interface Retrieval {
  search(query: RetrievalQuery): Promise<RetrievalResult>;
}

export function createRetrieval(overrides: Partial<RetrievalDependencies> = {}): Retrieval {
  const deps = { ...productionDependencies, ...overrides };
  return {
    async search(query) {
      const text = query.query.trim();
      if (!text) throw new Error('query required');
      if (query.mode === 'semantic') {
        if (!deps.hasEmbeddingKey()) {
          return {
            evidence: [],
            availability: { state: 'unavailable', reason: deps.embeddingUnavailableReason() },
            truncated: false,
          };
        }
        const hits = await deps.vectorSearch(
          text,
          query.topK ?? 8,
          query.folderRoot,
          query.pathPrefix,
          searchExtensionsForTypes(query.types ?? []) ?? undefined,
        );
        return { evidence: semanticEvidence(hits, query.folderRoot), availability: { state: 'ready' }, truncated: false };
      }

      const result = await deps.exactSearch(text, query.folderRoot, {
        caseStrict: query.caseStrict === true,
        wholeWord: query.wholeWord === true,
        pathPrefix: query.pathPrefix,
        extensions: searchExtensionsForTypes(query.types ?? []) ?? undefined,
      });
      const allEvidence = visibleKeywordEvidence(result.files, query.folderRoot);
      const limit = query.topK == null ? undefined : Math.max(1, Math.floor(query.topK));
      const evidence = limit == null ? allEvidence : allEvidence.slice(0, limit);
      const truncated = result.truncated || evidence.length < allEvidence.length;
      return {
        evidence,
        availability: truncated ? { state: 'partial', reason: 'truncated' } : { state: 'ready' },
        truncated,
      };
    },
  };
}
