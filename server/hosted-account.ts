import packageJson from '../package.json' with { type: 'json' };
import crypto from 'node:crypto';
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

export type HostedOAuthProvider = 'google' | 'github';

export interface HostedOAuthStart {
  flowId: string;
  provider: HostedOAuthProvider;
  url: string;
}

export interface HostedOAuthStatus {
  state: 'pending' | 'complete' | 'error';
  error?: string;
}

interface PendingOAuthFlow {
  provider: HostedOAuthProvider;
  verifier: string;
  createdAt: number;
  state: 'pending' | 'exchanged' | 'complete' | 'error';
  error?: string;
}

const OAUTH_FLOW_TTL_MS = 10 * 60 * 1000;
const pendingOAuthFlows = new Map<string, PendingOAuthFlow>();

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

function base64Url(bytes: Buffer): string {
  return bytes.toString('base64url');
}

function pruneOAuthFlows(now = Date.now()): void {
  for (const [flowId, flow] of pendingOAuthFlows) {
    if (now - flow.createdAt > OAUTH_FLOW_TTL_MS) pendingOAuthFlows.delete(flowId);
  }
}

function assertLoopbackCallbackOrigin(callbackOrigin: string): URL {
  const parsed = new URL(callbackOrigin);
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) {
    throw new Error('OAuth callback must use the local StashBase server.');
  }
  return parsed;
}

export function beginHostedOAuth(provider: HostedOAuthProvider, callbackOrigin: string): HostedOAuthStart {
  pruneOAuthFlows();
  const origin = assertLoopbackCallbackOrigin(callbackOrigin);
  const flowId = base64Url(crypto.randomBytes(24));
  const verifier = base64Url(crypto.randomBytes(48));
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
  const callback = new URL('/api/account/oauth/callback', origin);
  callback.searchParams.set('flow', flowId);

  pendingOAuthFlows.set(flowId, {
    provider,
    verifier,
    createdAt: Date.now(),
    state: 'pending',
  });

  const authorize = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  authorize.searchParams.set('provider', provider);
  authorize.searchParams.set('redirect_to', callback.toString());
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 's256');
  return { flowId, provider, url: authorize.toString() };
}

export async function exchangeHostedOAuthCode(flowId: string, authCode: string): Promise<HostedAccountSession> {
  pruneOAuthFlows();
  const flow = pendingOAuthFlows.get(flowId);
  if (!flow || flow.state !== 'pending') throw new Error('This sign-in request expired. Start again from StashBase.');
  if (!authCode.trim()) throw new Error('Supabase did not return an authorization code.');
  try {
    const payload = await supabaseAuth('/token?grant_type=pkce', {
      auth_code: authCode,
      code_verifier: flow.verifier,
    });
    const session = sessionFrom(payload);
    lastQuota = undefined;
    setHostedAccountSession(session);
    flow.state = 'exchanged';
    return session;
  } catch (error: unknown) {
    failHostedOAuth(flowId, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export function finishHostedOAuth(flowId: string): void {
  const flow = pendingOAuthFlows.get(flowId);
  if (flow?.state === 'exchanged') flow.state = 'complete';
}

export function failHostedOAuth(flowId: string, message: string): void {
  const flow = pendingOAuthFlows.get(flowId);
  if (!flow) return;
  flow.state = 'error';
  flow.error = message;
}

export function hostedOAuthStatus(flowId: string): HostedOAuthStatus {
  pruneOAuthFlows();
  const flow = pendingOAuthFlows.get(flowId);
  if (!flow) return { state: 'error', error: 'This sign-in request expired. Start again.' };
  if (flow.state === 'complete') return { state: 'complete' };
  if (flow.state === 'error') return { state: 'error', error: flow.error ?? 'Sign-in failed.' };
  return { state: 'pending' };
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
