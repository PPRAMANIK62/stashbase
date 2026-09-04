import { MediaError, type MediaApi } from '@/features/documents/application/ports';
import { documentViewerFormat } from '@/features/documents/domain/document-format';
import type { MediaTranscriptState } from '@/features/documents/domain/media';
import type { HttpClient, HttpResponse } from '@/platform/http/client';
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

function mediaResponseError(response: HttpResponse): MediaError {
  const failure = mediaFailureSchema.safeParse(response.body);
  const cause = failure.success ? { cause: new Error(failure.data.error) } : undefined;
  if (response.status === 401 || response.status === 403) {
    return new MediaError(
      'unauthorized',
      'This window can no longer access that media file.',
      cause,
    );
  }
  if (response.status === 410 || response.status === 412) {
    return new MediaError(
      'scope-lost',
      'The media folder is no longer available in this window.',
      cause,
    );
  }
  return new MediaError('unavailable', 'The media information could not be loaded.', cause);
}

function mediaRequest(source: SourceReference) {
  const request = mediaRequestSchema.safeParse(source);
  if (!request.success || documentViewerFormat(source.path) !== 'media') {
    throw new MediaError('unavailable', 'The media identity is invalid.');
  }
  return request.data;
}

function mediaQuery(source: SourceReference): string {
  const request = mediaRequest(source);
  return new URLSearchParams({ folder: request.folderPath, path: request.path }).toString();
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

async function request(
  client: HttpClient,
  input: Parameters<HttpClient['request']>[0],
): Promise<HttpResponse> {
  try {
    const response = await client.request(input);
    if (response.status < 200 || response.status >= 300) throw mediaResponseError(response);
    return response;
  } catch (error) {
    if (error instanceof MediaError || input.signal?.aborted) throw error;
    throw new MediaError('unavailable', 'The media information could not be loaded.', {
      cause: error,
    });
  }
}

export function createMediaApi(client: HttpClient): MediaApi {
  return {
    async cancelTranscript(source, signal) {
      const identity = mediaRequest(source);
      const response = await request(client, {
        body: { folder: identity.folderPath, path: identity.path },
        method: 'POST',
        path: '/api/files/cancel-preparation',
        signal,
      });
      const body = mediaCancelResponseSchema.safeParse(response.body);
      if (!body.success) {
        throw new MediaError(
          'invalid-response',
          'The transcript cancellation returned an invalid response.',
        );
      }
      return body.data.cancelled;
    },
    async loadPreviewStatus(source, signal) {
      const response = await request(client, {
        path: `/api/audio/preview/status?${mediaQuery(source)}`,
        signal,
      });
      const body = mediaPreviewStatusSchema.safeParse(response.body);
      if (!body.success) {
        throw new MediaError(
          'invalid-response',
          'The compatible preview returned invalid progress.',
        );
      }
      return body.data;
    },
    async loadTranscript(source, signal) {
      const response = await request(client, {
        path: `/api/audio/transcript?${mediaQuery(source)}`,
        signal,
      });
      const body = mediaTranscriptResponseSchema.safeParse(response.body);
      if (!body.success) {
        throw new MediaError('invalid-response', 'The transcript returned an invalid response.');
      }
      return mapTranscript(body.data);
    },
    async preparePreview(source, signal) {
      const identity = mediaRequest(source);
      const response = await request(client, {
        body: { folder: identity.folderPath, path: identity.path },
        method: 'POST',
        path: '/api/audio/preview/prepare',
        signal,
      });
      if (!mediaPrepareResponseSchema.safeParse(response.body).success) {
        throw new MediaError(
          'invalid-response',
          'The compatible preview returned an invalid response.',
        );
      }
    },
    async reprocessTranscript(source, signal) {
      const identity = mediaRequest(source);
      const response = await request(client, {
        body: { folder: identity.folderPath, path: identity.path },
        method: 'POST',
        path: '/api/files/reprocess',
        signal,
      });
      if (!mediaReprocessResponseSchema.safeParse(response.body).success) {
        throw new MediaError(
          'invalid-response',
          'The transcript retry returned an invalid response.',
        );
      }
    },
  };
}
