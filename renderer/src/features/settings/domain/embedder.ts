/**
 * The AI Index source as the renderer reasons about it: which provider or
 * account currently answers embeddings, what the reader is told about the
 * hosted allowance, and how a sign-in flow ends.
 *
 * These are the feature's own types, not the wire's. Absence is a `null`
 * field rather than a missing key, so a view never has to tell "the server
 * omitted it" apart from "there is none"; `infrastructure/embedder-api.ts`
 * owns the translation from the transport shapes.
 */

export type EmbedderProvider = 'openai' | 'openrouter';

/** Every source an index can be authorized against. `local` is server-owned:
 *  it can be active, but the renderer never selects it. */
export type EmbeddingSource = EmbedderProvider | 'local' | 'stashbase-account';

/** The hosted account, spelled as a source so one radio group can offer it
 *  beside the bring-your-own-key providers. */
export const ACCOUNT_SOURCE: EmbeddingSource = 'stashbase-account';

/** The providers a reader may choose between, in offer order. */
export const EMBEDDER_PROVIDERS: readonly EmbedderProvider[] = ['openai', 'openrouter'];

export const EMBEDDER_PROVIDER_LABELS: Record<EmbedderProvider, string> = {
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
};

export interface HostedQuota {
  readonly grantedTokens: number;
  readonly periodEndsAt: string | null;
  readonly periodStartedAt: string | null;
  readonly plan: string;
  readonly remainingTokens: number;
  readonly reservedTokens: number;
  readonly usedTokens: number;
}

export interface HostedAccount {
  /** The account is the authorized embedding source right now. */
  readonly active: boolean;
  readonly displayName: string | null;
  readonly email: string | null;
  readonly quota: HostedQuota | null;
  /** The server holds an account but could not report its usage this time. */
  readonly quotaUnavailable: boolean;
  readonly signedIn: boolean;
}

export interface EmbedderState {
  readonly account: HostedAccount;
  readonly authorized: boolean;
  readonly hasKey: boolean;
  readonly model: string;
  readonly provider: EmbedderProvider;
  readonly source: EmbeddingSource;
}

/** A stored key answers with the one thing the reader still needs to see:
 *  whether StashBase could verify it before saving. */
export interface EmbedderKeySave {
  readonly warning: string | null;
}

export interface HostedSignIn {
  readonly flowId: string;
  readonly url: string;
}

/** A browser sign-in ends exactly three ways, and only the failure carries a
 *  sentence, so the poll result cannot report an error without one. */
export type HostedSignInStatus =
  | { readonly state: 'pending' }
  | { readonly state: 'complete' }
  | { readonly state: 'error'; readonly error: string };

/** The source answering embeddings, or `null` while nothing is authorized. */
export function activeEmbeddingSource(state: EmbedderState): EmbeddingSource | null {
  return state.authorized ? state.source : null;
}

export function quotaRemainingPercent(account: HostedAccount): number {
  const quota = account.quota;
  if (!quota || quota.grantedTokens <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((quota.remainingTokens / quota.grantedTokens) * 100)),
  );
}

/** One sentence of standing usage. A missing quota reads as not-yet-reported
 *  rather than as zero, so an empty allowance never looks like a spent one. */
export function describeQuota(account: HostedAccount): string {
  if (account.quotaUnavailable) return 'Usage is temporarily unavailable.';
  const quota = account.quota;
  if (!quota) return 'Usage not reported yet.';
  const reset = quota.periodEndsAt
    ? new Date(quota.periodEndsAt).toLocaleDateString([], { dateStyle: 'medium' })
    : null;
  const remaining = quota.remainingTokens.toLocaleString();
  return `${quotaRemainingPercent(account)}% remaining · ${remaining} tokens left${
    reset ? ` · Resets ${reset}` : ''
  }`;
}

/** What the current source means for search, said once under the group. */
export function describeEmbedderSource(state: EmbedderState): string {
  const active = activeEmbeddingSource(state);
  if (active === ACCOUNT_SOURCE) {
    return 'Meaning-based search and indexing use your StashBase account.';
  }
  if (active !== null) {
    return `Meaning-based search and indexing use your ${EMBEDDER_PROVIDER_LABELS[state.provider]} key.`;
  }
  return 'AI Index is not set up. Sign in or add a key. Exact search keeps working.';
}
