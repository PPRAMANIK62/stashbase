import {
  SemanticSearchError,
  type SemanticSearchApi,
} from '@/features/retrieval/application/ports';
import {
  semanticHitId,
  semanticSnippet,
  type SemanticSearchResult,
} from '@/features/retrieval/domain/semantic-search';
import type { HttpClient, HttpResponse } from '@/platform/http/client';
import {
  semanticSearchFailureSchema,
  semanticSearchRequestSchema,
  semanticSearchResponseSchema,
  type SemanticSearchResponseWire,
} from '@/protocols/http/semantic-search';

function mapResult(result: SemanticSearchResponseWire): SemanticSearchResult {
  return {
    hits: result.hits.map((hit) => {
      const source = { folderPath: hit.folder, path: hit.path };
      return {
        chunkIndex: hit.chunkIndex,
        content: hit.content,
        ...(hit.endLine === undefined ? {} : { endLine: hit.endLine }),
        heading: hit.heading,
        id: semanticHitId(source, hit.chunkIndex),
        ...(hit.pdfPage === undefined ? {} : { pdfPage: hit.pdfPage }),
        score: hit.score,
        snippet: semanticSnippet(hit.content),
        source,
        ...(hit.startLine === undefined ? {} : { startLine: hit.startLine }),
      };
    }),
    truncated: result.truncated ?? false,
  };
}

function mapResponse(response: HttpResponse): SemanticSearchResult {
  if (response.status >= 200 && response.status < 300) {
    const result = semanticSearchResponseSchema.safeParse(response.body);
    if (result.success) return mapResult(result.data);
    throw new SemanticSearchError('invalid-response', 'Search returned an invalid response.');
  }
  const failure = semanticSearchFailureSchema.safeParse(response.body);
  const cause = failure.success ? { cause: new Error(failure.data.error) } : undefined;
  if (response.status === 402 || failure.data?.code === 'HOSTED_QUOTA_EXHAUSTED') {
    throw new SemanticSearchError(
      'quota-exhausted',
      'Your hosted AI Index allowance is exhausted. Exact search is still available.',
      cause,
    );
  }
  if (response.status === 412 || failure.data?.code === 'EMBEDDER_KEY_REQUIRED') {
    throw new SemanticSearchError('not-set-up', 'Set up AI Index to search by meaning.', cause);
  }
  throw new SemanticSearchError('unavailable', 'Search is unavailable.', cause);
}

export function createSemanticSearchApi(client: HttpClient): SemanticSearchApi {
  return {
    async search(request, signal) {
      try {
        const body = semanticSearchRequestSchema.parse({
          ...(request.folderPath ? { folder: request.folderPath } : {}),
          mode: 'semantic',
          query: request.query,
          top_k: request.topK,
        });
        return mapResponse(
          await client.request({ body, method: 'POST', path: '/api/library/search', signal }),
        );
      } catch (error) {
        if (error instanceof SemanticSearchError || signal.aborted) throw error;
        throw new SemanticSearchError('unavailable', 'Search is unavailable.', { cause: error });
      }
    },
  };
}
