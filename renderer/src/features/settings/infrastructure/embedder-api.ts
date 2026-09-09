/**
 * The one place the embedder wire shapes are spoken.
 *
 * The transport models an absent field as a missing key and lets a failed
 * sign-in answer without a sentence; the feature's own vocabulary
 * (`domain/embedder.ts`) models absence as `null` and gives every failure a
 * sentence. The mappers below are that translation, so nothing above this
 * adapter imports a protocol module.
 */

import { EmbedderError, type EmbedderPort } from '@/features/settings/application/embedder-port';
import type {
  EmbedderKeySave,
  EmbedderState,
  HostedAccount,
  HostedQuota,
  HostedSignIn,
  HostedSignInStatus,
} from '@/features/settings/domain/embedder';
import {
  request,
  requestOptions,
  type TransportCall,
  type TransportFailure,
  type TransportRequest,
} from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
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
  type EmbedderKeySaveResponseWire,
  type EmbedderStateWire,
  type HostedAccountStateWire,
  type HostedOAuthStartResponseWire,
  type HostedOAuthStatusWire,
} from '@/protocols/http/embedder';

function toQuota(wire: NonNullable<HostedAccountStateWire['quota']>): HostedQuota {
  return {
    grantedTokens: wire.grantedTokens,
    periodEndsAt: wire.periodEndsAt,
    periodStartedAt: wire.periodStartedAt,
    plan: wire.plan,
    remainingTokens: wire.remainingTokens,
    reservedTokens: wire.reservedTokens,
    usedTokens: wire.usedTokens,
  };
}

function toAccount(wire: HostedAccountStateWire): HostedAccount {
  return {
    active: wire.active,
    displayName: wire.displayName ?? null,
    email: wire.email ?? null,
    quota: wire.quota === undefined ? null : toQuota(wire.quota),
    quotaUnavailable: wire.quotaUnavailable ?? false,
    signedIn: wire.signedIn,
  };
}

function toEmbedderState(wire: EmbedderStateWire): EmbedderState {
  return {
    account: toAccount(wire.account),
    authorized: wire.authorized,
    hasKey: wire.hasKey,
    model: wire.model,
    provider: wire.provider,
    source: wire.source,
  };
}

function toKeySave(wire: EmbedderKeySaveResponseWire): EmbedderKeySave {
  return { warning: wire.warning ?? null };
}

function toSignIn(wire: HostedOAuthStartResponseWire): HostedSignIn {
  return { flowId: wire.flowId, url: wire.url };
}

function toSignInStatus(wire: HostedOAuthStatusWire): HostedSignInStatus {
  switch (wire.state) {
    case 'complete':
      return { state: 'complete' };
    case 'error':
      return { state: 'error', error: wire.error ?? 'Sign-in failed.' };
    case 'pending':
      return { state: 'pending' };
  }
}

/** The embedder routes refuse what the user can fix — a key the provider will
 *  not accept, an account that cannot supply embeddings — with a 4xx and their
 *  own sentence. Everything else is an unreachable capability. */
function rejection(fallback: string) {
  return ({ response, serverMessage }: TransportFailure): EmbedderError | null => {
    if (response.status < 400 || response.status >= 500) return null;
    return new EmbedderError(
      'rejected',
      serverMessage ?? fallback,
      serverMessage === null ? undefined : { cause: new Error(serverMessage) },
    );
  };
}

function call(
  path: string,
  signal: AbortSignal,
  fallback: string,
  extra?: { body?: unknown; method?: TransportCall['method'] },
): TransportRequest<'rejected'> {
  return requestOptions({
    ...extra,
    error: EmbedderError,
    failure: rejection(fallback),
    failureSchema: embedderFailureSchema,
    messages: {
      'invalid-response': `${fallback} The server answered unexpectedly.`,
      unavailable: fallback,
    },
    path,
    serverMessage: true,
    signal,
  });
}

export function createEmbedderAdapter(client: HttpClient): EmbedderPort {
  return {
    async load(signal) {
      return toEmbedderState(
        await request(client, {
          ...call('/api/embedder', signal, 'AI Index settings are unavailable.'),
          schema: embedderStateSchema,
        }),
      );
    },
    async refreshAccount(signal) {
      return toAccount(
        await request(client, {
          ...call('/api/account?refresh=1', signal, 'Account usage is unavailable.'),
          schema: hostedAccountStateSchema,
        }),
      );
    },
    async removeKey(signal) {
      return toEmbedderState(
        await request(client, {
          ...call('/api/embedder/key', signal, 'The key could not be removed.', {
            method: 'DELETE',
          }),
          schema: embedderStateSchema,
        }),
      );
    },
    async saveKey(provider, key, signal) {
      return toKeySave(
        await request(client, {
          ...call('/api/embedder/key', signal, 'The key could not be saved.', {
            body: embedderKeyRequestSchema.parse({ key, provider }),
            method: 'PUT',
          }),
          schema: embedderKeySaveResponseSchema,
        }),
      );
    },
    async selectProvider(provider, signal) {
      return toEmbedderState(
        await request(client, {
          ...call('/api/embedder/source', signal, 'The source could not be selected.', {
            body: embedderSourceRequestSchema.parse({ source: provider }),
            method: 'PUT',
          }),
          schema: embedderStateSchema,
        }),
      );
    },
    async signInStatus(flowId, signal) {
      const query = new URLSearchParams({ flow: flowId });
      return toSignInStatus(
        await request(client, {
          ...call(`/api/account/oauth/status?${query}`, signal, 'Sign-in status is unavailable.'),
          schema: hostedOAuthStatusSchema,
        }),
      );
    },
    async signOut(signal) {
      await request(client, {
        ...call('/api/account', signal, 'Sign-out failed.', { method: 'DELETE' }),
        schema: hostedAccountStateSchema,
      });
    },
    async startSignIn(signal) {
      return toSignIn(
        await request(client, {
          ...call('/api/account/oauth/start', signal, 'Sign-in could not start.', {
            body: hostedOAuthStartRequestSchema.parse({ provider: 'google', purpose: 'embedding' }),
            method: 'POST',
          }),
          schema: hostedOAuthStartResponseSchema,
        }),
      );
    },
    async useAccount(signal) {
      return toAccount(
        await request(client, {
          ...call('/api/account/source', signal, 'The account could not be selected.', {
            method: 'PUT',
          }),
          schema: hostedAccountStateSchema,
        }),
      );
    },
  };
}
