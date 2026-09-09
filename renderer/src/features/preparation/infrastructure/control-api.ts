import {
  PreparationError,
  type PreparationControlApi,
} from '@/features/preparation/application/ports';
import type { HttpClient, HttpResponse } from '@/platform/http/client';
import { folderSyncResponseSchema } from '@/protocols/http/index-status';
import {
  preparationAcknowledgementSchema,
  preparationCancelResponseSchema,
  preparationFailureResponseSchema,
  preparationReprocessRequestSchema,
  preparationReprocessResponseSchema,
  preparationSourceRequestSchema,
} from '@/protocols/http/preparation';
import type { SourceReference } from '@/shared/domain/source-reference';

function controlError(response: HttpResponse, fallback: string): PreparationError {
  const failure = preparationFailureResponseSchema.safeParse(response.body);
  const message = failure.success ? failure.data.error : fallback;
  const cause = failure.success ? { cause: new Error(failure.data.error) } : undefined;
  if (response.status === 409 && failure.data?.code === 'TRANSCRIPTION_NOT_READY') {
    return new PreparationError('blocked', message, cause);
  }
  if (response.status === 415) return new PreparationError('unsupported', message, cause);
  if (
    response.status === 404 ||
    response.status === 412 ||
    failure.data?.code === 'FOLDER_NOT_FOUND' ||
    failure.data?.code === 'NO_FOLDER'
  ) {
    return new PreparationError('scope-lost', 'This file is no longer available.', cause);
  }
  return new PreparationError('unavailable', fallback, cause);
}

async function post(
  client: HttpClient,
  path: string,
  body: unknown,
  signal: AbortSignal,
  fallback: string,
): Promise<HttpResponse> {
  let response: HttpResponse;
  try {
    response = await client.request({ body, method: 'POST', path, signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new PreparationError('unavailable', fallback, { cause: error });
  }
  if (response.status < 200 || response.status >= 300) throw controlError(response, fallback);
  return response;
}

function sourceBody(source: SourceReference) {
  return preparationSourceRequestSchema.parse({ folder: source.folderPath, path: source.path });
}

export function createPreparationControlApi(client: HttpClient): PreparationControlApi {
  return {
    async prepare(source, signal) {
      const response = await post(
        client,
        '/api/files/prepare',
        sourceBody(source),
        signal,
        'Preparation could not start.',
      );
      if (!preparationAcknowledgementSchema.safeParse(response.body).success) {
        throw new PreparationError('invalid-response', 'Preparation returned an invalid response.');
      }
    },
    async reprocess(source, options, signal) {
      const body = preparationReprocessRequestSchema.parse({
        folder: source.folderPath,
        ...(options.language ? { language: options.language } : {}),
        path: source.path,
      });
      const response = await post(
        client,
        '/api/files/reprocess',
        body,
        signal,
        'Reprocess could not start. Try again.',
      );
      const parsed = preparationReprocessResponseSchema.safeParse(response.body);
      if (!parsed.success) {
        throw new PreparationError('invalid-response', 'Reprocess returned an invalid response.');
      }
      return parsed.data.mode;
    },
    async cancel(source, signal) {
      const response = await post(
        client,
        '/api/files/cancel-preparation',
        sourceBody(source),
        signal,
        'Preparation could not be cancelled.',
      );
      const parsed = preparationCancelResponseSchema.safeParse(response.body);
      if (!parsed.success) {
        throw new PreparationError(
          'invalid-response',
          'Cancellation returned an invalid response.',
        );
      }
      return parsed.data.cancelled;
    },
    async sync(folderPath, signal) {
      const query = new URLSearchParams({ folder: folderPath });
      const response = await post(
        client,
        `/api/sync?${query}`,
        undefined,
        signal,
        'The folder could not be refreshed.',
      );
      const parsed = folderSyncResponseSchema.safeParse(response.body);
      if (!parsed.success) {
        throw new PreparationError('invalid-response', 'Sync returned an invalid response.');
      }
      return parsed.data.cancelled !== true;
    },
  };
}
