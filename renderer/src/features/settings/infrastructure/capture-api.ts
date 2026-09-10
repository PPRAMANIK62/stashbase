import type { CapturePort } from '@/features/settings/application/ports';
import { settingsRequest } from '@/features/settings/infrastructure/settings-request';
import { request } from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import {
  captureFailureSchema,
  capturePreferencesRequestSchema,
  capturePreferencesSchema,
} from '@/protocols/http/capture';

function preferences(signal: AbortSignal, unavailable: string) {
  return settingsRequest({
    failureSchema: captureFailureSchema,
    invalidResponse: 'Capture settings returned an invalid response.',
    path: '/api/capture',
    signal,
    unavailable,
  });
}

export function createCaptureAdapter(client: HttpClient): CapturePort {
  return {
    async load(signal) {
      const parsed = await request(client, {
        ...preferences(signal, 'Capture settings are unavailable.'),
        schema: capturePreferencesSchema,
      });
      return { clipboardImageImport: parsed.clipboardImageImport };
    },
    async update(input, signal) {
      const parsed = await request(client, {
        ...preferences(signal, 'Capture settings could not be saved.'),
        body: capturePreferencesRequestSchema.parse(input),
        method: 'PUT',
        schema: capturePreferencesSchema,
      });
      return { clipboardImageImport: parsed.clipboardImageImport };
    },
  };
}
