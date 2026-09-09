import { SettingsError, type CapturePort } from '@/features/settings/application/ports';
import {
  request,
  requestOptions,
  type TransportFailure,
  type TransportRequest,
} from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import {
  captureFailureSchema,
  capturePreferencesRequestSchema,
  capturePreferencesSchema,
} from '@/protocols/http/capture';

/** A refused preference is the user's own request coming back, not a lost
 *  capability, so it reads as an invalid request. */
function invalidRequest(fallback: string) {
  return ({ response, serverMessage }: TransportFailure): SettingsError | null =>
    response.status === 400
      ? new SettingsError('invalid-request', serverMessage ?? fallback)
      : null;
}

function preferences(
  path: string,
  signal: AbortSignal,
  fallback: string,
): TransportRequest<'invalid-request'> {
  return requestOptions({
    error: SettingsError,
    failure: invalidRequest(fallback),
    failureSchema: captureFailureSchema,
    messages: {
      'invalid-response': 'Capture settings returned an invalid response.',
      unavailable: fallback,
    },
    path,
    serverMessage: true,
    signal,
  });
}

export function createCaptureAdapter(client: HttpClient): CapturePort {
  return {
    async load(signal) {
      const parsed = await request(client, {
        ...preferences('/api/capture', signal, 'Capture settings are unavailable.'),
        schema: capturePreferencesSchema,
      });
      return { clipboardImageImport: parsed.clipboardImageImport };
    },
    async update(input, signal) {
      const parsed = await request(client, {
        ...preferences('/api/capture', signal, 'Capture settings could not be saved.'),
        body: capturePreferencesRequestSchema.parse(input),
        method: 'PUT',
        schema: capturePreferencesSchema,
      });
      return { clipboardImageImport: parsed.clipboardImageImport };
    },
  };
}
