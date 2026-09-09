import { EmbedderError, type EmbedderPort } from '@/features/settings/application/embedder-port';
import type { HttpClient, HttpRequest, HttpResponse } from '@/platform/http/client';
import {
  embedderFailureSchema,
  embedderKeyRequestSchema,
  embedderKeySaveResponseSchema,
  embedderSourceRequestSchema,
  embedderStateSchema,
  hostedAccountStateSchema,
  hostedOAuthStartRequestSchema,
  hostedOAuthStartResponseSchema,
  hostedOAuthStatusSchema,
} from '@/protocols/http/embedder';

type Schema<T> = { safeParse(input: unknown): { success: true; data: T } | { success: false } };

function failure(response: HttpResponse, fallback: string): EmbedderError {
  const parsed = embedderFailureSchema.safeParse(response.body);
  const message = parsed.success ? parsed.data.error : fallback;
  const rejected = response.status >= 400 && response.status < 500;
  return new EmbedderError(
    rejected ? 'rejected' : 'unavailable',
    message,
    parsed.success ? { cause: new Error(parsed.data.error) } : undefined,
  );
}

async function call<T>(
  client: HttpClient,
  request: HttpRequest,
  schema: Schema<T>,
  fallback: string,
): Promise<T> {
  let response: HttpResponse;
  try {
    response = await client.request(request);
  } catch (error) {
    if (request.signal?.aborted) throw error;
    throw new EmbedderError('unavailable', fallback, { cause: error });
  }
  if (response.status < 200 || response.status >= 300) throw failure(response, fallback);
  const parsed = schema.safeParse(response.body);
  if (!parsed.success) {
    throw new EmbedderError('invalid-response', `${fallback} The server answered unexpectedly.`);
  }
  return parsed.data;
}

export function createEmbedderApi(client: HttpClient): EmbedderPort {
  return {
    load(signal) {
      return call(
        client,
        { path: '/api/embedder', signal },
        embedderStateSchema,
        'AI Index settings are unavailable.',
      );
    },
    refreshAccount(signal) {
      return call(
        client,
        { path: '/api/account?refresh=1', signal },
        hostedAccountStateSchema,
        'Account usage is unavailable.',
      );
    },
    removeKey(signal) {
      return call(
        client,
        { method: 'DELETE', path: '/api/embedder/key', signal },
        embedderStateSchema,
        'The key could not be removed.',
      );
    },
    saveKey(provider, key, signal) {
      return call(
        client,
        {
          body: embedderKeyRequestSchema.parse({ key, provider }),
          method: 'PUT',
          path: '/api/embedder/key',
          signal,
        },
        embedderKeySaveResponseSchema,
        'The key could not be saved.',
      );
    },
    selectProvider(provider, signal) {
      return call(
        client,
        {
          body: embedderSourceRequestSchema.parse({ source: provider }),
          method: 'PUT',
          path: '/api/embedder/source',
          signal,
        },
        embedderStateSchema,
        'The source could not be selected.',
      );
    },
    signInStatus(flowId, signal) {
      const query = new URLSearchParams({ flow: flowId });
      return call(
        client,
        { path: `/api/account/oauth/status?${query}`, signal },
        hostedOAuthStatusSchema,
        'Sign-in status is unavailable.',
      );
    },
    async signOut(signal) {
      await call(
        client,
        { method: 'DELETE', path: '/api/account', signal },
        hostedAccountStateSchema,
        'Sign-out failed.',
      );
    },
    startSignIn(signal) {
      return call(
        client,
        {
          body: hostedOAuthStartRequestSchema.parse({ provider: 'google', purpose: 'embedding' }),
          method: 'POST',
          path: '/api/account/oauth/start',
          signal,
        },
        hostedOAuthStartResponseSchema,
        'Sign-in could not start.',
      );
    },
    useAccount(signal) {
      return call(
        client,
        { method: 'PUT', path: '/api/account/source', signal },
        hostedAccountStateSchema,
        'The account could not be selected.',
      );
    },
  };
}
