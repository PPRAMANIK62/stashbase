import { ExactSearchError, type ExactSearchApi } from '@/features/retrieval/application/ports';
import {
  exactSearchFileId,
  type ExactSearchResult,
} from '@/features/retrieval/domain/exact-search';
import type { HttpClient, HttpResponse } from '@/platform/http/client';
import {
  exactSearchFailureSchema,
  exactSearchRequestSchema,
  exactSearchResponseSchema,
  type ExactSearchResponseWire,
} from '@/protocols/http/search';

function mapResult(result: ExactSearchResponseWire): ExactSearchResult {
  return {
    files: result.files.map((file) => {
      const source = { folderPath: file.folder, path: file.path };
      return {
        id: exactSearchFileId(source),
        matches: file.matches.map((match) => ({
          ...(match.audioTimestampMs === undefined
            ? {}
            : { audioTimestampMs: match.audioTimestampMs }),
          line: match.line,
          ...(match.pdfPage === undefined ? {} : { pdfPage: match.pdfPage }),
          ranges: match.ranges.map(([start, end]) => ({ end, start })),
          text: match.text,
        })),
        source,
        totalMatches: file.totalMatches,
      };
    }),
    totalMatches: result.totalMatches,
    truncated: result.truncated,
  };
}

function mapResponse(response: HttpResponse): ExactSearchResult {
  if (response.status >= 200 && response.status < 300) {
    const result = exactSearchResponseSchema.safeParse(response.body);
    if (result.success) return mapResult(result.data);
    throw new ExactSearchError('invalid-response', 'Search returned an invalid response.');
  }
  const failure = exactSearchFailureSchema.safeParse(response.body);
  throw new ExactSearchError(
    'unavailable',
    'Search is unavailable.',
    failure.success ? { cause: new Error(failure.data.error) } : undefined,
  );
}

export function createExactSearchApi(client: HttpClient): ExactSearchApi {
  return {
    async search(request, signal) {
      try {
        const body = exactSearchRequestSchema.parse({
          case_strict: request.caseSensitive,
          ...(request.folderPath ? { folder: request.folderPath } : {}),
          query: request.query,
          whole_word: request.wholeWord,
        });
        return mapResponse(
          await client.request({
            body,
            method: 'POST',
            path: '/api/library/keyword-search',
            signal,
          }),
        );
      } catch (error) {
        if (error instanceof ExactSearchError || signal.aborted) throw error;
        throw new ExactSearchError('unavailable', 'Search is unavailable.', { cause: error });
      }
    },
  };
}
