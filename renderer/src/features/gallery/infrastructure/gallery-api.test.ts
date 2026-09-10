/** The index transport: what reaches the shop, what the proxy rewrites, and
 *  why nothing here throws. */
import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createGalleryIndexAdapter } from './gallery-api';

const ENTRY = {
  category: 'course',
  contents: '20 transcripts',
  description: 'A course.',
  id: 'cs183b',
  name: 'How to Start a Startup',
  repo: 'https://github.com/owner/repo',
};

function client(response: { body: unknown; status?: number } | Error): HttpClient {
  return {
    request: vi.fn(async () => {
      if (response instanceof Error) throw response;
      return { body: response.body, status: response.status ?? 200 };
    }),
  };
}

const load = (transport: HttpClient) =>
  createGalleryIndexAdapter(transport).loadIndex(new AbortController().signal);

describe('gallery index adapter', () => {
  it('makes every optional slot explicit rather than absent', async () => {
    const entries = await load(client({ body: { schemaVersion: 1, wikis: [ENTRY] } }));
    expect(entries).toEqual([
      {
        category: 'course',
        contents: '20 transcripts',
        description: 'A course.',
        files: null,
        id: 'cs183b',
        learnMore: null,
        name: 'How to Start a Startup',
        repo: 'https://github.com/owner/repo',
        screenshots: null,
        starterPrompts: [],
        wikiPrompt: null,
      },
    ]);
  });

  it('points every published screenshot at the daemon proxy', async () => {
    // The renderer's CSP pins img-src to 'self'; a CDN URL reaching a view
    // would simply not load, silently.
    const entries = await load(
      client({
        body: {
          schemaVersion: 1,
          wikis: [{ ...ENTRY, screenshots: ['https://assets.stashbase.ai/a.png', '/local.png'] }],
        },
      }),
    );
    expect(entries?.[0]?.screenshots).toEqual([
      '/api/gallery/image?src=https%3A%2F%2Fassets.stashbase.ai%2Fa.png',
      '/local.png',
    ]);
  });

  it('answers null for every index it cannot read', async () => {
    // Unreachable, malformed, and a future schema are one outcome to a shop
    // that always has the snapshot. The offline envelope is a 200 by design,
    // so it has to be caught by the schema rather than by the status.
    expect(await load(client({ body: { error: 'offline', schemaVersion: 0 } }))).toBeNull();
    expect(await load(client({ body: { schemaVersion: 9, wikis: [] } }))).toBeNull();
    expect(await load(client({ body: null, status: 502 }))).toBeNull();
    expect(await load(client(new Error('network down')))).toBeNull();
  });
});
