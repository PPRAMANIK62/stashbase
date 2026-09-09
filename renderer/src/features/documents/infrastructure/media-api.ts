import { MediaError, type MediaPort } from '@/features/documents/application/ports';
import { documentViewerFormat } from '@/features/documents/domain/document-format';
import type { MediaTranscriptState } from '@/features/documents/domain/media';
import { request, type TransportRequest } from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import {
  mediaCancelResponseSchema,
  mediaFailureSchema,
  mediaPrepareResponseSchema,
  mediaPreviewStatusSchema,
  mediaReprocessResponseSchema,
  mediaRequestSchema,
  mediaTranscriptResponseSchema,
  type MediaTranscriptResponseWire,
} from '@/protocols/http/media';
import type { SourceReference } from '@/shared/domain/source-reference';

function mediaRequest(source: SourceReference) {
  const parsed = mediaRequestSchema.safeParse(source);
  if (!parsed.success || documentViewerFormat(source.path) !== 'audio') {
    throw new MediaError('unavailable', 'The media identity is invalid.');
  }
  return parsed.data;
}

function mediaQuery(source: SourceReference): string {
  const identity = mediaRequest(source);
  return new URLSearchParams({ folder: identity.folderPath, path: identity.path }).toString();
}

function mapTranscript(response: MediaTranscriptResponseWire): MediaTranscriptState {
  if (response.status === 'ready') {
    return {
      status: 'ready',
      transcript: {
        durationMs: response.transcript.source.durationMs,
        language: response.transcript.language,
        model: response.transcript.provider.model,
        segments: response.transcript.segments,
      },
    };
  }
  if (response.status === 'pending') {
    return { status: 'pending', ...(response.progress ? { progress: response.progress } : {}) };
  }
  if (response.status === 'blocked') {
    return {
      providerId: response.providerId,
      reason: response.reason,
      status: 'blocked',
      ...('modelId' in response ? { modelId: response.modelId } : {}),
    };
  }
  return { status: response.status };
}

/** One media call: every media route reads the same file identity and reports
 *  the same ladder. */
function media(
  path: string,
  signal: AbortSignal,
  invalid: string,
  body?: unknown,
): TransportRequest {
  return {
    ...(body === undefined ? {} : { body, method: 'POST' as const }),
    error: MediaError,
    failureSchema: mediaFailureSchema,
    messages: {
      'invalid-response': invalid,
      'scope-lost': 'The media folder is no longer available in this window.',
      unauthorized: 'This window can no longer access that media file.',
      unavailable: 'The media information could not be loaded.',
    },
    path,
    signal,
  };
}

export function createMediaAdapter(client: HttpClient): MediaPort {
  return {
    async cancelTranscript(source, signal) {
      const identity = mediaRequest(source);
      const body = await request(client, {
        ...media(
          '/api/files/cancel-preparation',
          signal,
          'The transcript cancellation returned an invalid response.',
          { folder: identity.folderPath, path: identity.path },
        ),
        schema: mediaCancelResponseSchema,
      });
      return body.cancelled;
    },
    loadPreviewStatus(source, signal) {
      return request(client, {
        ...media(
          `/api/audio/preview/status?${mediaQuery(source)}`,
          signal,
          'The compatible preview returned invalid progress.',
        ),
        schema: mediaPreviewStatusSchema,
      });
    },
    async loadTranscript(source, signal) {
      return mapTranscript(
        await request(client, {
          ...media(
            `/api/audio/transcript?${mediaQuery(source)}`,
            signal,
            'The transcript returned an invalid response.',
          ),
          schema: mediaTranscriptResponseSchema,
        }),
      );
    },
    async preparePreview(source, signal) {
      const identity = mediaRequest(source);
      await request(client, {
        ...media(
          '/api/audio/preview/prepare',
          signal,
          'The compatible preview returned an invalid response.',
          { folder: identity.folderPath, path: identity.path },
        ),
        schema: mediaPrepareResponseSchema,
      });
    },
    async reprocessTranscript(source, signal) {
      const identity = mediaRequest(source);
      await request(client, {
        ...media(
          '/api/files/reprocess',
          signal,
          'The transcript retry returned an invalid response.',
          {
            folder: identity.folderPath,
            path: identity.path,
          },
        ),
        schema: mediaReprocessResponseSchema,
      });
    },
  };
}
