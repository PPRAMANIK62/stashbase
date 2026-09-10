/**
 * The Gallery index transport.
 *
 * The renderer's CSP pins `connect-src` and `img-src` to `'self'`, so both the
 * published index and every screenshot cross through the daemon's proxy. That
 * is the design rather than a workaround: the shop reaches a curated external
 * host, and the proxy is where that reach is bounded.
 *
 * Nothing here throws. An unreachable index and an unreadable one are the same
 * outcome to a shop that always has the bundled snapshot to fall back to, and
 * the route already answers total failure with a success envelope carrying an
 * unsupported schema so an offline session prints no console error. Treating a
 * refusal as an exception would put that error back.
 */
import type { GalleryPort } from '@/features/gallery/application/ports';
import type { GalleryEntry } from '@/features/gallery/domain/entry';
import type { HttpClient } from '@/platform/http/client';
import { galleryIndexSchema, type GalleryEntryWire } from '@/protocols/http/gallery';

const GALLERY_INDEX_PATH = '/api/gallery/index';
const GALLERY_IMAGE_PATH = '/api/gallery/image';

/** Published screenshot URLs are absolute CDN links the renderer may not load.
 *  Anything already relative passes through: a future local asset is not a
 *  proxy's business. */
function proxied(url: string): string {
  return /^https?:\/\//iu.test(url)
    ? `${GALLERY_IMAGE_PATH}?src=${encodeURIComponent(url)}`
    : url;
}

function toEntry(wire: GalleryEntryWire): GalleryEntry {
  return {
    category: wire.category,
    contents: wire.contents,
    description: wire.description,
    files: wire.files ?? null,
    id: wire.id,
    learnMore: wire.learnMore ?? null,
    name: wire.name,
    repo: wire.repo,
    screenshots: wire.screenshots?.map(proxied) ?? null,
    starterPrompts: wire.starterPrompts,
    wikiPrompt: wire.wikiPrompt ?? null,
  };
}

export function createGalleryIndexAdapter(
  client: HttpClient,
): Pick<GalleryPort, 'loadIndex'> {
  return {
    async loadIndex(signal) {
      try {
        const response = await client.request({ path: GALLERY_INDEX_PATH, signal });
        if (response.status < 200 || response.status >= 300) return null;
        const index = galleryIndexSchema.safeParse(response.body);
        return index.success ? index.data.wikis.map(toEntry) : null;
      } catch {
        return null;
      }
    },
  };
}
