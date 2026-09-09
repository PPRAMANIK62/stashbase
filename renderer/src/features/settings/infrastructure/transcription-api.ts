import { SettingsError, type TranscriptionPort } from '@/features/settings/application/ports';
import type { HttpClient, HttpRequest, HttpResponse } from '@/platform/http/client';
import {
  transcriptionAcknowledgementSchema,
  transcriptionFailureSchema,
  transcriptionModelDownloadResponseSchema,
  transcriptionPreferencesRequestSchema,
  transcriptionPreferencesResponseSchema,
  transcriptionSettingsSchema,
} from '@/protocols/http/transcription';

const unavailableMessage = 'Transcription settings are unavailable.';

function failure(response: HttpResponse, fallback: string): SettingsError {
  const parsed = transcriptionFailureSchema.safeParse(response.body);
  const message = parsed.success ? parsed.data.error : fallback;
  return new SettingsError(response.status === 400 ? 'invalid-request' : 'unavailable', message, {
    cause: parsed.success ? new Error(parsed.data.error) : undefined,
  });
}

async function send(
  client: HttpClient,
  request: HttpRequest,
  fallback: string,
): Promise<HttpResponse> {
  let response: HttpResponse;
  try {
    response = await client.request(request);
  } catch (error) {
    if (request.signal?.aborted) throw error;
    throw new SettingsError('unavailable', fallback, { cause: error });
  }
  if (response.status < 200 || response.status >= 300) throw failure(response, fallback);
  return response;
}

function modelPath(id: string): string {
  return `/api/transcription/models/${encodeURIComponent(id)}`;
}

export function createTranscriptionApi(client: HttpClient): TranscriptionPort {
  return {
    async load(signal) {
      const response = await send(
        client,
        { path: '/api/transcription/settings', signal },
        unavailableMessage,
      );
      const parsed = transcriptionSettingsSchema.safeParse(response.body);
      if (!parsed.success) {
        throw new SettingsError(
          'invalid-response',
          'Transcription settings returned an invalid response.',
        );
      }
      return parsed.data;
    },
    async updatePreferences(patch, signal) {
      const body = transcriptionPreferencesRequestSchema.parse(patch);
      const response = await send(
        client,
        { body, method: 'PUT', path: '/api/transcription/preferences', signal },
        'Transcription preferences could not be saved.',
      );
      const parsed = transcriptionPreferencesResponseSchema.safeParse(response.body);
      if (!parsed.success) {
        throw new SettingsError(
          'invalid-response',
          'Transcription preferences returned an invalid response.',
        );
      }
      return parsed.data;
    },
    async downloadModel(id, signal) {
      const response = await send(
        client,
        { method: 'POST', path: `${modelPath(id)}/download`, signal },
        'The model download could not start.',
      );
      const parsed = transcriptionModelDownloadResponseSchema.safeParse(response.body);
      if (!parsed.success) {
        throw new SettingsError(
          'invalid-response',
          'The model download returned an invalid response.',
        );
      }
      return parsed.data.download;
    },
    async removeModel(id, signal) {
      const response = await send(
        client,
        { method: 'DELETE', path: modelPath(id), signal },
        'The model could not be removed.',
      );
      if (!transcriptionAcknowledgementSchema.safeParse(response.body).success) {
        throw new SettingsError('invalid-response', 'Model removal returned an invalid response.');
      }
    },
  };
}
