/**
 * Resource extraction + reference rewriting — architecture §4.2 steps 2-3.
 *
 * Pulls embedded `data:` resources out of a freshly-ingested note and
 * materialises them as real files under the note's `<stem>_files/`
 * bundle, rewriting each reference to a relative bundle path. The note
 * stays lean (no megabytes of inline base64), the images become real,
 * previewable, dedup-able assets, and the iframe viewer resolves them
 * via the existing `/asset/*` → `<stem>_files/` route.
 *
 * Scope (deliberate):
 *   - **`data:` URIs** in HTML `src` / `href` attributes and Markdown
 *     `![](…)` image refs are extracted. This is the case that actually
 *     breaks a *standalone* note dropped on its own: SingleFile / "save
 *     as HTML" exports and pasted Markdown inline their images as base64.
 *   - **Remote `http(s)` refs** are left untouched — the design keeps
 *     them as live links (§4.2 step 2).
 *   - **Existing relative refs** (`<img src="figure.png">`) are left
 *     alone: when they arrive they're already real sibling files from a
 *     browser "Save Page As Complete" bundle, sitting where the iframe
 *     expects them. Re-homing those is a separate concern.
 *
 * Identical inline payloads dedupe to one file (content-hash filename),
 * so a note that repeats a spacer/logo 50× writes it once.
 */
import { blake3 } from '@noble/hashes/blake3.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { detectFormat, matchNoteStem } from './format.ts';

export interface ExtractedAsset {
  /** Path in the SAME convention as the note path passed in (a sibling
   *  under `<stem>_files/`). The caller writes the bytes here. */
  path: string;
  bytes: Buffer;
}

export interface ExtractResult {
  /** Note content with `data:` refs rewritten to relative bundle paths.
   *  Identical to the input when nothing was extracted. */
  content: string;
  assets: ExtractedAsset[];
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
  'image/tiff': 'tiff',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'font/woff2': 'woff2',
  'font/woff': 'woff',
  'application/font-woff': 'woff',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'application/pdf': 'pdf',
  'text/css': 'css',
};

function extForMime(mime: string): string {
  const lower = mime.toLowerCase();
  if (MIME_EXT[lower]) return MIME_EXT[lower];
  const subtype = lower.split('/')[1] ?? '';
  const cleaned = subtype.split('+')[0].replace(/[^a-z0-9]/g, '');
  return cleaned || 'bin';
}

/** Decode one `data:` URI to its bytes + extension, or null if it isn't
 *  a parseable data URI. */
function decodeDataUri(uri: string): { bytes: Buffer; ext: string } | null {
  if (!/^data:/i.test(uri)) return null;
  const comma = uri.indexOf(',');
  if (comma < 0) return null;
  const header = uri.slice('data:'.length, comma);
  const payload = uri.slice(comma + 1);
  const mime = (header.split(';')[0] || 'application/octet-stream').trim();
  const isBase64 = /;base64/i.test(header);
  try {
    const bytes = isBase64
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf8');
    if (bytes.length === 0) return null;
    return { bytes, ext: extForMime(mime) };
  } catch {
    return null;
  }
}

/** Split a note path into the pieces needed to build its bundle: the
 *  directory prefix (same convention as the input), the visible bundle
 *  dir name (`<stem>_files`), and the in-note relative ref prefix. */
function bundleFor(notePath: string): { dirPrefix: string; bundleName: string } | null {
  const m = matchNoteStem(notePath);
  if (!m) return null;
  return { dirPrefix: m.dir, bundleName: `${m.stem}_files` };
}

/**
 * Extract embedded `data:` resources from `content` for the note at
 * `notePath`. Returns the rewritten content + the assets to write.
 * `notePath`'s convention (space-relative or kbRoot-relative) is
 * preserved in the returned asset paths, since the bundle is a sibling.
 */
export function extractEmbeddedResources(notePath: string, content: string): ExtractResult {
  const format = detectFormat(notePath);
  if (format !== 'html' && format !== 'md') return { content, assets: [] };
  const bundle = bundleFor(notePath);
  if (!bundle) return { content, assets: [] };

  const assets: ExtractedAsset[] = [];
  // hash+ext → in-note relative ref, so a repeated payload writes once.
  const seen = new Map<string, string>();

  const materialize = (uri: string): string | null => {
    const decoded = decodeDataUri(uri);
    if (!decoded) return null;
    const hash = bytesToHex(blake3(decoded.bytes)).slice(0, 16);
    const key = `${hash}.${decoded.ext}`;
    const existing = seen.get(key);
    if (existing) return existing;
    const ref = `${bundle.bundleName}/${key}`;
    seen.set(key, ref);
    assets.push({ path: `${bundle.dirPrefix}${ref}`, bytes: decoded.bytes });
    return ref;
  };

  let out = content;

  // Markdown image refs: ![alt](data:…) — data URIs carry no unescaped
  // ')' so a non-greedy stop at the first ')' is safe.
  out = out.replace(
    /(!\[[^\]]*\]\(\s*)(data:[^)\s]+)(\s*\))/gi,
    (whole, pre: string, uri: string, post: string) => {
      const ref = materialize(uri);
      return ref ? `${pre}${ref}${post}` : whole;
    },
  );

  // HTML (or HTML embedded in Markdown) src=/href= attributes. Quoted
  // values only — a base64 / percent-encoded data URI never needs
  // unquoting, and scoping to quotes keeps the match unambiguous.
  out = out.replace(
    /(\b(?:src|href)\s*=\s*)(["'])(data:[^"']+)\2/gi,
    (whole, attr: string, q: string, uri: string) => {
      const ref = materialize(uri);
      return ref ? `${attr}${q}${ref}${q}` : whole;
    },
  );

  return { content: out, assets };
}
