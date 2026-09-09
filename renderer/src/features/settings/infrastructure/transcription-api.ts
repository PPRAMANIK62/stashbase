/**
 * The one place the transcription wire shapes are spoken. The transport omits
 * a model's operation when nothing is running and omits every optional trait;
 * `domain/transcription.ts` says a model is always in exactly one operation
 * state and spells the rest as `null`, so the mappers below close that gap
 * and keep protocol imports out of everything above this adapter.
 */

import { SettingsError, type TranscriptionPort } from '@/features/settings/application/ports';
import type {
  TranscriptionModel,
  TranscriptionModelOperation,
  TranscriptionPreferences,
  TranscriptionProvider,
  TranscriptionSettings,
} from '@/features/settings/domain/transcription';
import {
  request,
  requestOptions,
  type TransportFailure,
  type TransportRequest,
} from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import {
  transcriptionAcknowledgementSchema,
  transcriptionFailureSchema,
  transcriptionModelDownloadResponseSchema,
  transcriptionPreferencesRequestSchema,
  transcriptionPreferencesResponseSchema,
  transcriptionSettingsSchema,
  type TranscriptionModelOperationWire,
  type TranscriptionModelWire,
  type TranscriptionProviderWire,
  type TranscriptionSettingsWire,
} from '@/protocols/http/transcription';

const UNAVAILABLE = 'Transcription settings are unavailable.';

function toOperation(
  wire: TranscriptionModelOperationWire | undefined,
): TranscriptionModelOperation {
  if (wire === undefined) return { status: 'idle' };
  switch (wire.status) {
    case 'downloading':
      return {
        status: 'downloading',
        receivedBytes: wire.receivedBytes,
        totalBytes: wire.totalBytes,
      };
    case 'verifying':
      return { status: 'verifying' };
    case 'failed':
      return { status: 'failed', error: wire.error };
    case 'idle':
      return { status: 'idle' };
  }
}

function toModel(wire: TranscriptionModelWire): TranscriptionModel {
  return {
    accuracy: wire.accuracy ?? null,
    available: wire.available,
    id: wire.id,
    label: wire.label,
    management: wire.management,
    operation: toOperation(wire.operation),
    resourceUse: wire.resourceUse ?? null,
    sizeBytes: wire.sizeBytes ?? null,
    speed: wire.speed ?? null,
  };
}

function toProvider(wire: TranscriptionProviderWire): TranscriptionProvider {
  return {
    description: wire.description,
    id: wire.id,
    kind: wire.kind,
    label: wire.label,
    models: wire.models.map(toModel),
    runtimeError: wire.runtimeError ?? null,
  };
}

function toSettings(wire: TranscriptionSettingsWire): TranscriptionSettings {
  return {
    language: wire.language,
    modelId: wire.modelId,
    providerId: wire.providerId,
    providers: wire.providers.map(toProvider),
  };
}

function toPreferences(wire: TranscriptionPreferences): TranscriptionPreferences {
  return { language: wire.language, modelId: wire.modelId, providerId: wire.providerId };
}

/** A refused preference is the user's own request coming back, not a lost
 *  capability, so it reads as an invalid request. */
function invalidRequest(fallback: string) {
  return ({ response, serverMessage }: TransportFailure): SettingsError | null =>
    response.status === 400
      ? new SettingsError(
          'invalid-request',
          serverMessage ?? fallback,
          serverMessage === null ? undefined : { cause: new Error(serverMessage) },
        )
      : null;
}

function transcription(
  path: string,
  signal: AbortSignal,
  messages: { invalid: string; unavailable: string },
): TransportRequest<'invalid-request'> {
  return requestOptions({
    error: SettingsError,
    failure: invalidRequest(messages.unavailable),
    failureSchema: transcriptionFailureSchema,
    messages: { 'invalid-response': messages.invalid, unavailable: messages.unavailable },
    path,
    serverMessage: true,
    signal,
  });
}

function modelPath(id: string): string {
  return `/api/transcription/models/${encodeURIComponent(id)}`;
}

export function createTranscriptionAdapter(client: HttpClient): TranscriptionPort {
  return {
    async load(signal) {
      return toSettings(
        await request(client, {
          ...transcription('/api/transcription/settings', signal, {
            invalid: 'Transcription settings returned an invalid response.',
            unavailable: UNAVAILABLE,
          }),
          schema: transcriptionSettingsSchema,
        }),
      );
    },
    async updatePreferences(patch, signal) {
      return toPreferences(
        await request(client, {
          ...transcription('/api/transcription/preferences', signal, {
            invalid: 'Transcription preferences returned an invalid response.',
            unavailable: 'Transcription preferences could not be saved.',
          }),
          body: transcriptionPreferencesRequestSchema.parse(patch),
          method: 'PUT',
          schema: transcriptionPreferencesResponseSchema,
        }),
      );
    },
    async downloadModel(id, signal) {
      const parsed = await request(client, {
        ...transcription(`${modelPath(id)}/download`, signal, {
          invalid: 'The model download returned an invalid response.',
          unavailable: 'The model download could not start.',
        }),
        method: 'POST',
        schema: transcriptionModelDownloadResponseSchema,
      });
      return toOperation(parsed.download);
    },
    async removeModel(id, signal) {
      await request(client, {
        ...transcription(modelPath(id), signal, {
          invalid: 'Model removal returned an invalid response.',
          unavailable: 'The model could not be removed.',
        }),
        method: 'DELETE',
        schema: transcriptionAcknowledgementSchema,
      });
    },
  };
}
