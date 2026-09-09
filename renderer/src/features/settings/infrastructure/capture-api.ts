import { SettingsError, type CapturePort } from '@/features/settings/application/ports';
import type { HttpClient, HttpRequest, HttpResponse } from '@/platform/http/client';
import {
  captureFailureSchema,
  capturePreferencesRequestSchema,
  capturePreferencesSchema,
} from '@/protocols/http/capture';

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
  if (response.status < 200 || response.status >= 300) {
    const parsed = captureFailureSchema.safeParse(response.body);
    throw new SettingsError(
      response.status === 400 ? 'invalid-request' : 'unavailable',
      parsed.success ? parsed.data.error : fallback,
    );
  }
  return response;
}

function mapPreferences(response: HttpResponse) {
  const parsed = capturePreferencesSchema.safeParse(response.body);
  if (!parsed.success) {
    throw new SettingsError('invalid-response', 'Capture settings returned an invalid response.');
  }
  return { clipboardImageImport: parsed.data.clipboardImageImport };
}

export function createCaptureApi(client: HttpClient): CapturePort {
  return {
    async load(signal) {
      return mapPreferences(
        await send(client, { path: '/api/capture', signal }, 'Capture settings are unavailable.'),
      );
    },
    async update(preferences, signal) {
      const body = capturePreferencesRequestSchema.parse(preferences);
      return mapPreferences(
        await send(
          client,
          { body, method: 'PUT', path: '/api/capture', signal },
          'Capture settings could not be saved.',
        ),
      );
    },
  };
}
