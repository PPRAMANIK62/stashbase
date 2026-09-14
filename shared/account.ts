/**
 * The signed-in StashBase account used by the hosted Agent runtime.
 *
 * An account is optional throughout the product — the project works
 * anonymously — so every consumer has to be able to render "no account"
 * without treating it as an error.
 */

/** Public Agent allowance intentionally exposes only the user-facing weekly
 * percentage and token detail. Picodollar accounting stays server-side. */
export interface HostedAgentAllowance {
  profile: string;
  remainingPercent: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  windowStartedAt: string | null;
  windowEndsAt: string | null;
}

export interface HostedAccountState {
  signedIn: boolean;
  email?: string;
  displayName?: string;
  /** Same-origin renderer endpoint; the provider URL remains Node-only. */
  avatarUrl?: string;
}

export type HostedOAuthProvider = 'google';
export type HostedOAuthPurpose = 'account';

export interface HostedOAuthStart {
  flowId: string;
  provider: HostedOAuthProvider;
  purpose: HostedOAuthPurpose;
  url: string;
}

export interface HostedOAuthStatus {
  state: 'pending' | 'complete' | 'error';
  error?: string;
  appReturned?: boolean;
}
