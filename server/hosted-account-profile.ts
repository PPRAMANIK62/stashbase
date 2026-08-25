const GOOGLE_AVATAR_HOST = 'lh3.googleusercontent.com';

export function normalizeHostedDisplayName(value: unknown): string | undefined {
  const normalized = typeof value === 'string'
    ? value.replace(/[\p{Cc}\p{Cf}]/gu, '').trim().replace(/\s+/gu, ' ')
    : '';
  return normalized ? Array.from(normalized).slice(0, 200).join('') : undefined;
}

export function parseGoogleAvatarUrl(value: unknown): URL | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname === GOOGLE_AVATAR_HOST
      && !url.username && !url.password) return url;
  } catch { /* invalid and disallowed URLs share the same absent-profile fallback */ }
  return undefined;
}
