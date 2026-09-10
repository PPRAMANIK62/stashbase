import { SettingsError, type AppearancePort } from '@/features/settings/application/ports';
import {
  request,
  requestOptions,
  type TransportFailure,
  type TransportRequest,
} from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import {
  appearanceFailureSchema,
  appearancePreferencesRequestSchema,
  appearancePreferencesSchema,
} from '@/protocols/http/appearance';

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
    failureSchema: appearanceFailureSchema,
    messages: {
      'invalid-response': 'Appearance settings returned an invalid response.',
      unavailable: fallback,
    },
    path,
    serverMessage: true,
    signal,
  });
}

export function createAppearanceAdapter(client: HttpClient): AppearancePort {
  return {
    async load(signal) {
      const parsed = await request(client, {
        ...preferences('/api/appearance', signal, 'Appearance settings are unavailable.'),
        schema: appearancePreferencesSchema,
      });
      return {
        theme: parsed.theme,
        uiScale: parsed.uiScale,
        readingTextSize: parsed.readingTextSize,
      };
    },
    async update(change, signal) {
      const parsed = await request(client, {
        ...preferences('/api/appearance', signal, 'Appearance settings could not be saved.'),
        body: appearancePreferencesRequestSchema.parse(change),
        method: 'PUT',
        schema: appearancePreferencesSchema,
      });
      return {
        theme: parsed.theme,
        uiScale: parsed.uiScale,
        readingTextSize: parsed.readingTextSize,
      };
    },
  };
}
