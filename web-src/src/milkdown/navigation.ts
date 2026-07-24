import { assetBaseUrl } from '../api';

export type MilkdownLinkTarget =
  | { kind: 'anchor'; id: string }
  | { kind: 'note'; path: string; anchor?: string }
  | { kind: 'external'; href: string }
  | { kind: 'ignore' };

/** Resolve document links without allowing encoded separators to escape the
 * current workspace-relative asset namespace. */
export function resolveMilkdownLink(raw: string, noteName: string): MilkdownLinkTarget {
  if (!raw) return { kind: 'ignore' };
  if (raw.startsWith('#')) return { kind: 'anchor', id: raw.slice(1) };
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  let url: URL;
  try { url = new URL(raw, new URL(assetBaseUrl(noteName), origin)); } catch { return { kind: 'ignore' }; }
  const asset = url.pathname.match(/^\/asset\/(?:__window\/[^/]+\/)?(.+)$/);
  if (asset) {
    try {
      const decoded = asset[1].split('/').map(decodeURIComponent);
      if (decoded.some((segment) => !segment || segment === '.' || segment === '..' || /[\\/]/.test(segment))) return { kind: 'ignore' };
      const path = decoded.join('/');
      if (/\.(md|markdown|html|htm)$/i.test(path)) return { kind: 'note', path, anchor: url.hash.slice(1) || undefined };
      return { kind: 'ignore' };
    } catch { return { kind: 'ignore' }; }
  }
  return url.protocol === 'http:' || url.protocol === 'https:' ? { kind: 'external', href: url.href } : { kind: 'ignore' };
}
