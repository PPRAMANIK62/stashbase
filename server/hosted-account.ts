import packageJson from '../package.json' with { type: 'json' };
import {
  getEmbeddingSource,
  getHostedAccountSession,
  setHostedAccountSession,
  type HostedAccountSession,
} from './app-config.ts';

export const STASHBASE_API_URL = 'https://api.stashbase.ai';
const SUPABASE_URL = 'https://vqtfigkoihpuziaimluf.supabase.co';
// Supabase publishable keys are intentionally safe to ship in clients. The
// project secret key remains server-only and must never enter this repository.
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_D-S7Ry-IWC9pTdDx6DHHHw_-mmaTp3b';
const CLIENT_VERSION = packageJson.version;

export interface HostedQuota {
  plan: string;
  grantedTokens: number;
  usedTokens: number;
  reservedTokens: number;
  remainingTokens: number;
  periodStartedAt: string | null;
  periodEndsAt: string | null;
}

export interface HostedAccountState {
  signedIn: boolean;
  active: boolean;
  userId?: string;
  email?: string;
  quota?: HostedQuota;
  quotaUnavailable?: boolean;
}

interface SupabaseTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  user?: { id?: string; email?: string };
  error?: string;
  error_description?: string;
  msg?: string;
}

interface ErrorPayload {
  code?: string;
  message?: string;
  error?: string;
  error_description?: string;
  msg?: string;
}

function messageOf(value: ErrorPayload | null, fallback: string): string {
  return value?.message ?? value?.error_description ?? value?.msg ?? value?.error ?? fallback;
}

async function jsonBody<T>(response: Response): Promise<T | null> {
  try { return await response.json() as T; } catch { return null; }
}

function sessionFrom(value: SupabaseTokenResponse, fallback?: HostedAccountSession): HostedAccountSession {
  const accessToken = value.access_token;
  const refreshToken = value.refresh_token ?? fallback?.refreshToken;
  const userId = value.user?.id ?? fallback?.userId;
  const email = value.user?.email ?? fallback?.email;
  const expiresAt = value.expires_at ?? (value.expires_in ? Math.floor(Date.now() / 1000) + value.expires_in : fallback?.expiresAt);
  if (!accessToken || !refreshToken || !userId || !email || !expiresAt) {
    throw new Error('Supabase returned an incomplete login session.');
  }
  return { accessToken, refreshToken, userId, email, expiresAt };
}

async function supabaseAuth(path: string, body: Record<string, unknown>, accessToken?: string): Promise<SupabaseTokenResponse> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await jsonBody<SupabaseTokenResponse>(response);
  if (!response.ok) throw new Error(messageOf(payload ?? null, `Supabase authentication failed (HTTP ${response.status}).`));
  return payload ?? {};
}

export async function requestEmailOtp(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new Error('Enter a valid email address.');
  await supabaseAuth('/otp', { email: normalized, create_user: true });
}

export async function verifyEmailOtp(email: string, token: string): Promise<HostedAccountSession> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedToken = token.replace(/\s+/g, '');
  if (!normalizedToken) throw new Error('Enter the verification code from your email.');
  const payload = await supabaseAuth('/verify', {
    email: normalizedEmail,
    token: normalizedToken,
    type: 'email',
  });
  const session = sessionFrom(payload);
  lastQuota = undefined;
  setHostedAccountSession(session);
  return session;
}

export async function hostedAccessToken(options: { forceRefresh?: boolean } = {}): Promise<string> {
  const session = getHostedAccountSession();
  if (!session) throw new Error('Sign in to StashBase to use the hosted allowance.');
  if (!options.forceRefresh && session.expiresAt > Math.floor(Date.now() / 1000) + 60) return session.accessToken;
  try {
    const payload = await supabaseAuth('/token?grant_type=refresh_token', { refresh_token: session.refreshToken });
    const refreshed = sessionFrom(payload, session);
    setHostedAccountSession(refreshed);
    return refreshed.accessToken;
  } catch (error) {
    setHostedAccountSession(undefined);
    throw error;
  }
}

export async function signOutHostedAccount(): Promise<void> {
  const session = getHostedAccountSession();
  lastQuota = undefined;
  setHostedAccountSession(undefined);
  if (!session) return;
  try { await supabaseAuth('/logout?scope=local', {}, session.accessToken); } catch { /* local sign-out still succeeds */ }
}

export async function fetchHostedQuota(options: { forceRefreshToken?: boolean } = {}): Promise<HostedQuota> {
  const token = await hostedAccessToken({ forceRefresh: options.forceRefreshToken });
  const response = await fetch(`${STASHBASE_API_URL}/v1/account/usage`, {
    headers: {
      authorization: `Bearer ${token}`,
      'x-stashbase-client-version': CLIENT_VERSION,
    },
  });
  const payload = await jsonBody<HostedQuota & ErrorPayload>(response);
  if (response.status === 401 && !options.forceRefreshToken) return fetchHostedQuota({ forceRefreshToken: true });
  if (!response.ok) throw new Error(messageOf(payload, `StashBase account service failed (HTTP ${response.status}).`));
  return payload as HostedQuota;
}

let lastQuota: HostedQuota | undefined;

export function rememberHostedQuota(quota: HostedQuota): void {
  lastQuota = quota;
}

export function cachedHostedQuota(): HostedQuota | undefined {
  return lastQuota;
}

export async function hostedAccountState(refreshQuota = false): Promise<HostedAccountState> {
  const session = getHostedAccountSession();
  if (!session) return { signedIn: false, active: false };
  let quota = lastQuota;
  let quotaUnavailable = false;
  if (refreshQuota || !quota) {
    try {
      quota = await fetchHostedQuota();
      lastQuota = quota;
    } catch {
      if (!getHostedAccountSession()) return { signedIn: false, active: false };
      quotaUnavailable = true;
    }
  }
  return {
    signedIn: true,
    active: getEmbeddingSource() === 'stashbase-account',
    userId: session.userId,
    email: session.email,
    ...(quota ? { quota } : {}),
    ...(quotaUnavailable ? { quotaUnavailable: true } : {}),
  };
}

export function stashbaseClientVersion(): string {
  return CLIENT_VERSION;
}
