import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createSemanticSearchAdapter } from './semantic-search-api';

const signal = new AbortController().signal;

describe('semantic search API', () => {
  it('posts the semantic mode with an explicit folder and maps folder-qualified hits', async () => {
    const request = vi.fn(async () => ({
      body: {
        hits: [
          {
            chunkIndex: 3,
            content: 'A   long\nchunk body',
            fileName: '/library/research/notes/idea.md',
            folder: '/library/research',
            heading: 'Ideas',
            path: 'notes/idea.md',
            score: 0.7,
            startLine: 12,
          },
        ],
      },
      status: 200,
    }));
    const result = await createSemanticSearchAdapter({ request }).search(
      { folderPath: '/library/research', query: 'idea', topK: 30 },
      signal,
    );
    expect(request).toHaveBeenCalledWith({
      body: { folder: '/library/research', mode: 'semantic', query: 'idea', top_k: 30 },
      method: 'POST',
      path: '/api/library/search',
      signal,
    });
    expect(result).toEqual({
      hits: [
        {
          chunkIndex: 3,
          content: 'A   long\nchunk body',
          heading: 'Ideas',
          id: '/library/research\u0000notes/idea.md\u00003',
          score: 0.7,
          snippet: 'A long chunk body',
          source: { folderPath: '/library/research', path: 'notes/idea.md' },
          startLine: 12,
        },
      ],
      truncated: false,
    });
  });

  it('classifies a missing embedding source and an exhausted allowance', async () => {
    const keyless: HttpClient = {
      request: vi.fn(async () => ({
        body: { code: 'EMBEDDER_KEY_REQUIRED', error: 'AI Index is disabled' },
        status: 412,
      })),
    };
    await expect(
      createSemanticSearchAdapter(keyless).search({ query: 'idea', topK: 8 }, signal),
    ).rejects.toMatchObject({ kind: 'not-set-up' });
    const quota: HttpClient = {
      request: vi.fn(async () => ({
        body: { code: 'HOSTED_QUOTA_EXHAUSTED', error: 'exhausted' },
        status: 402,
      })),
    };
    await expect(
      createSemanticSearchAdapter(quota).search({ query: 'idea', topK: 8 }, signal),
    ).rejects.toMatchObject({ kind: 'quota-exhausted' });
  });

  it('rethrows an abort without relabelling it', async () => {
    const controller = new AbortController();
    const abortError = new DOMException('aborted', 'AbortError');
    const client: HttpClient = {
      request: vi.fn(async () => {
        controller.abort();
        throw abortError;
      }),
    };
    await expect(
      createSemanticSearchAdapter(client).search({ query: 'idea', topK: 8 }, controller.signal),
    ).rejects.toBe(abortError);
  });
});
