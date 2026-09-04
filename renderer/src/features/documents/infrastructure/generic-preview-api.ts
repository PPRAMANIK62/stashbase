import {
  GenericFilePreviewError,
  type GenericFilePreviewApi,
} from '@/features/documents/application/ports';
import type { GenericFilePreview } from '@/features/documents/domain/generic-preview';
import type { HttpClient, HttpResponse } from '@/platform/http/client';
import {
  documentTextSourceFailureSchema,
  documentTextSourceRequestSchema,
  genericFilePreviewResponseSchema,
} from '@/protocols/http/files';

function encodePath(entryPath: string): string {
  return entryPath.split('/').map(encodeURIComponent).join('/');
}

function responseError(response: HttpResponse): GenericFilePreviewError {
  const failure = documentTextSourceFailureSchema.safeParse(response.body);
  const cause = failure.success ? { cause: new Error(failure.data.error) } : undefined;
  if (response.status === 415) {
    return new GenericFilePreviewError(
      'not-generic',
      'This file belongs to a format-specific viewer.',
      cause,
    );
  }
  if (response.status === 401 || response.status === 403) {
    return new GenericFilePreviewError(
      'unauthorized',
      'This window can no longer inspect that file.',
      cause,
    );
  }
  if (
    response.status === 410 ||
    response.status === 412 ||
    (failure.success &&
      (failure.data.code === 'FOLDER_UNAVAILABLE' || failure.data.code === 'NO_FOLDER'))
  ) {
    return new GenericFilePreviewError(
      'scope-lost',
      'The file folder is no longer available in this window.',
      cause,
    );
  }
  return new GenericFilePreviewError(
    'unavailable',
    'The file could not be inspected. It has not been changed.',
    cause,
  );
}

function mapPreview(response: unknown, expectedName: string): GenericFilePreview {
  const body = genericFilePreviewResponseSchema.safeParse(response);
  if (!body.success || body.data.name !== expectedName) {
    throw new GenericFilePreviewError(
      'invalid-response',
      'The file preview returned an invalid response.',
    );
  }
  if (body.data.kind === 'text') {
    return {
      content: body.data.content,
      kind: 'text',
      name: body.data.name,
      size: body.data.size,
      ...(body.data.version ? { version: body.data.version } : {}),
    };
  }
  return {
    kind: body.data.kind,
    name: body.data.name,
    ...(body.data.message ? { message: body.data.message } : {}),
    ...(body.data.size === undefined ? {} : { size: body.data.size }),
  };
}

export function createGenericFilePreviewApi(client: HttpClient): GenericFilePreviewApi {
  return {
    async load(source, signal) {
      const request = documentTextSourceRequestSchema.safeParse(source);
      if (!request.success) {
        throw new GenericFilePreviewError('unavailable', 'The file identity is invalid.');
      }
      const query = new URLSearchParams({ folder: request.data.folderPath });
      let response: HttpResponse;
      try {
        response = await client.request({
          path: `/api/file-preview/${encodePath(request.data.path)}?${query}`,
          signal,
        });
      } catch (error) {
        if (error instanceof GenericFilePreviewError || signal.aborted) throw error;
        throw new GenericFilePreviewError(
          'unavailable',
          'The file could not be inspected. It has not been changed.',
          { cause: error },
        );
      }
      if (response.status < 200 || response.status >= 300) throw responseError(response);
      return mapPreview(response.body, source.path);
    },
  };
}
