import {
  DocumentSourceError,
  type DocumentSourceApi,
} from '@/features/documents/application/ports';
import { documentTextFormat } from '@/features/documents/domain/document';
import type { HttpClient, HttpResponse } from '@/platform/http/client';
import {
  documentTextSourceFailureSchema,
  documentTextSourceRequestSchema,
  documentTextSourceResponseSchema,
} from '@/protocols/http/files';
import type { SourceReference } from '@/shared/domain/source-reference';

function encodePath(entryPath: string): string {
  return entryPath.split('/').map(encodeURIComponent).join('/');
}

function responseError(response: HttpResponse): DocumentSourceError {
  const failure = documentTextSourceFailureSchema.safeParse(response.body);
  const cause = failure.success ? { cause: new Error(failure.data.error) } : undefined;
  if (response.status === 401 || response.status === 403) {
    return new DocumentSourceError(
      'unauthorized',
      'This window can no longer read that document.',
      cause,
    );
  }
  if (
    response.status === 410 ||
    response.status === 412 ||
    (failure.success &&
      (failure.data.code === 'FOLDER_UNAVAILABLE' || failure.data.code === 'NO_FOLDER'))
  ) {
    return new DocumentSourceError(
      'scope-lost',
      'The document folder is no longer available in this window.',
      cause,
    );
  }
  return new DocumentSourceError('unavailable', 'The document could not be loaded.', cause);
}

function mapResponse(source: SourceReference, response: HttpResponse) {
  if (response.status < 200 || response.status >= 300) throw responseError(response);
  const body = documentTextSourceResponseSchema.safeParse(response.body);
  if (!body.success) {
    throw new DocumentSourceError('invalid-response', 'The document returned an invalid response.');
  }
  const expectedFormat = documentTextFormat(source.path);
  if (
    expectedFormat === null ||
    body.data.name !== source.path ||
    body.data.format !== expectedFormat
  ) {
    throw new DocumentSourceError('invalid-response', 'The document returned an invalid response.');
  }
  if ('error' in body.data) {
    throw new DocumentSourceError(
      'unsupported-encoding',
      'This text file is not valid UTF-8. It remains unchanged and read-only.',
      { cause: new Error(body.data.error.message) },
    );
  }
  return {
    content: body.data.content,
    format: expectedFormat,
    version: body.data.version,
  };
}

export function createDocumentSourceApi(client: HttpClient): DocumentSourceApi {
  return {
    async load(source, signal) {
      if (documentTextFormat(source.path) === null) {
        throw new DocumentSourceError(
          'unavailable',
          'This document format is not available in the text source loader.',
        );
      }
      const request = documentTextSourceRequestSchema.safeParse(source);
      if (!request.success) {
        throw new DocumentSourceError('unavailable', 'The document identity is invalid.');
      }
      const query = new URLSearchParams({ folder: request.data.folderPath });
      let response: HttpResponse;
      try {
        response = await client.request({
          path: `/api/files/${encodePath(request.data.path)}?${query}`,
          signal,
        });
      } catch (error) {
        if (error instanceof DocumentSourceError || signal.aborted) throw error;
        throw new DocumentSourceError('unavailable', 'The document could not be loaded.', {
          cause: error,
        });
      }
      return mapResponse(source, response);
    },
  };
}
