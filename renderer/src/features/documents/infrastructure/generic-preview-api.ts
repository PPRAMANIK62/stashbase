import {
  GenericFilePreviewError,
  type GenericFilePreviewPort,
} from '@/features/documents/application/ports';
import type { GenericFilePreview } from '@/features/documents/domain/generic-preview';
import { request, type TransportFailure } from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import {
  documentTextSourceFailureSchema,
  documentTextSourceRequestSchema,
  genericFilePreviewResponseSchema,
} from '@/protocols/http/files';

function encodePath(entryPath: string): string {
  return entryPath.split('/').map(encodeURIComponent).join('/');
}

const SCOPE_LOST = 'The file folder is no longer available in this window.';

/** Two refusals the shared ladder cannot see: a format that belongs to a
 *  dedicated viewer, and a folder the server names in the body. */
function previewFailure({
  response,
  serverMessage,
}: TransportFailure): GenericFilePreviewError | null {
  const failure = documentTextSourceFailureSchema.safeParse(response.body);
  const cause = serverMessage === null ? undefined : { cause: new Error(serverMessage) };
  if (response.status === 415) {
    return new GenericFilePreviewError(
      'not-generic',
      'This file belongs to a format-specific viewer.',
      cause,
    );
  }
  return failure.success &&
    (failure.data.code === 'FOLDER_UNAVAILABLE' || failure.data.code === 'NO_FOLDER')
    ? new GenericFilePreviewError('scope-lost', SCOPE_LOST, cause)
    : null;
}

function mapPreview(body: PreviewResponse, expectedName: string): GenericFilePreview {
  if (body.name !== expectedName) {
    throw new GenericFilePreviewError(
      'invalid-response',
      'The file preview returned an invalid response.',
    );
  }
  if (body.kind === 'text') {
    return {
      content: body.content,
      kind: 'text',
      name: body.name,
      size: body.size,
      ...(body.version ? { version: body.version } : {}),
    };
  }
  return {
    kind: body.kind,
    name: body.name,
    ...(body.message ? { message: body.message } : {}),
    ...(body.size === undefined ? {} : { size: body.size }),
  };
}

type PreviewResponse = ReturnType<typeof genericFilePreviewResponseSchema.parse>;

export function createGenericFilePreviewAdapter(client: HttpClient): GenericFilePreviewPort {
  return {
    async load(source, signal) {
      const identity = documentTextSourceRequestSchema.safeParse(source);
      if (!identity.success) {
        throw new GenericFilePreviewError('unavailable', 'The file identity is invalid.');
      }
      const query = new URLSearchParams({ folder: identity.data.folderPath });
      return mapPreview(
        await request(client, {
          error: GenericFilePreviewError,
          failure: previewFailure,
          failureSchema: documentTextSourceFailureSchema,
          messages: {
            'invalid-response': 'The file preview returned an invalid response.',
            'scope-lost': SCOPE_LOST,
            unauthorized: 'This window can no longer inspect that file.',
            unavailable: 'The file could not be inspected. It has not been changed.',
          },
          path: `/api/file-preview/${encodePath(identity.data.path)}?${query}`,
          schema: genericFilePreviewResponseSchema,
          signal,
        }),
        source.path,
      );
    },
  };
}
