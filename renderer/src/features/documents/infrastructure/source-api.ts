import {
  DocumentSaveError,
  DocumentSourceError,
  type DocumentSourceApi,
} from '@/features/documents/application/ports';
import { documentTextFormat } from '@/features/documents/domain/document';
import type { HttpClient, HttpResponse } from '@/platform/http/client';
import {
  documentTextSaveFailureSchema,
  documentTextOverwriteRequestSchema,
  documentTextSaveRequestSchema,
  documentTextSaveResponseSchema,
  documentTextSourceFailureSchema,
  documentTextSourceRequestSchema,
  documentTextSourceResponseSchema,
} from '@/protocols/http/files';
import type { SourceReference } from '@/shared/domain/source-reference';

function encodePath(entryPath: string): string {
  return entryPath.split('/').map(encodeURIComponent).join('/');
}

function saveResponseError(response: HttpResponse): DocumentSaveError {
  const failure = documentTextSaveFailureSchema.safeParse(response.body);
  const cause = failure.success ? { cause: new Error(failure.data.error) } : undefined;
  if (response.status === 409 && failure.success && failure.data.code === 'FILE_CHANGED') {
    return new DocumentSaveError(
      'conflict',
      'The file changed on disk. Your unsaved changes are still available.',
      { ...cause, currentVersion: failure.data.currentVersion },
    );
  }
  if (
    response.status === 409 ||
    response.status === 410 ||
    response.status === 412 ||
    (failure.success &&
      (failure.data.code === 'FOLDER_CHANGED' ||
        failure.data.code === 'FOLDER_UNAVAILABLE' ||
        failure.data.code === 'NO_FOLDER'))
  ) {
    return new DocumentSaveError(
      'scope-lost',
      'The document folder is no longer active in this window.',
      cause,
    );
  }
  if (response.status === 401 || response.status === 403) {
    return new DocumentSaveError(
      'unauthorized',
      'This window can no longer save that document.',
      cause,
    );
  }
  return new DocumentSaveError('unavailable', 'The document could not be saved.', cause);
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

function mapSaveResponse(source: SourceReference, response: HttpResponse) {
  if (response.status < 200 || response.status >= 300) throw saveResponseError(response);
  const body = documentTextSaveResponseSchema.safeParse(response.body);
  const expectedFormat = documentTextFormat(source.path);
  if (
    !body.success ||
    expectedFormat === null ||
    body.data.name !== source.path ||
    body.data.format !== expectedFormat
  ) {
    throw new DocumentSaveError(
      'invalid-response',
      'The document save returned an invalid response.',
    );
  }
  return {
    content: body.data.content,
    format: expectedFormat,
    version: body.data.version,
    ...(body.data.indexWarning ? { indexWarning: body.data.indexWarning } : {}),
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
    async overwrite(source, input, signal) {
      const request = documentTextOverwriteRequestSchema.safeParse({
        ...input,
        folderPath: source.folderPath,
        overwrite: true,
        path: source.path,
      });
      if (!request.success || documentTextFormat(source.path) === null) {
        throw new DocumentSaveError('unavailable', 'The document overwrite request is invalid.');
      }
      const query = new URLSearchParams({ folder: request.data.folderPath });
      let response: HttpResponse;
      try {
        response = await client.request({
          body: { content: request.data.content, overwrite: true },
          method: 'PUT',
          path: `/api/files/${encodePath(request.data.path)}?${query}`,
          signal,
        });
      } catch (error) {
        if (error instanceof DocumentSaveError || signal.aborted) throw error;
        throw new DocumentSaveError('unavailable', 'The document could not be overwritten.', {
          cause: error,
        });
      }
      return mapSaveResponse(source, response);
    },
    async save(source, input, signal) {
      const request = documentTextSaveRequestSchema.safeParse({
        ...input,
        folderPath: source.folderPath,
        path: source.path,
      });
      if (!request.success || documentTextFormat(source.path) === null) {
        throw new DocumentSaveError('unavailable', 'The document save request is invalid.');
      }
      const query = new URLSearchParams({ folder: request.data.folderPath });
      let response: HttpResponse;
      try {
        response = await client.request({
          body: { baseVersion: request.data.baseVersion, content: request.data.content },
          method: 'PUT',
          path: `/api/files/${encodePath(request.data.path)}?${query}`,
          signal,
        });
      } catch (error) {
        if (error instanceof DocumentSaveError || signal.aborted) throw error;
        throw new DocumentSaveError('unavailable', 'The document could not be saved.', {
          cause: error,
        });
      }
      return mapSaveResponse(source, response);
    },
  };
}
