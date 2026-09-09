import { describe, expect, it } from 'vite-plus/test';

import {
  canSemanticSearch,
  preparationReadinessLine,
  semanticIndexNotice,
} from './semantic-readiness';

describe('semantic readiness', () => {
  it('explains a missing source and an exhausted allowance without blocking exact search', () => {
    const missing = { state: 'not-set-up' } as const;
    expect(canSemanticSearch(missing)).toBe(false);
    expect(semanticIndexNotice(missing)).toMatchObject({
      actions: ['open-settings'],
      detail: 'Exact text search works without AI Index.',
      title: 'Set up AI Index to search by meaning.',
    });

    const quota = { state: 'quota-exhausted' } as const;
    expect(canSemanticSearch(quota)).toBe(false);
    expect(semanticIndexNotice(quota)?.title).toContain('allowance is exhausted');
    expect(semanticIndexNotice(quota)?.tone).toBe('attention');
  });

  it('offers build and resume decisions with the workload size', () => {
    expect(
      semanticIndexNotice({
        state: 'awaiting-decision',
        workload: { estimatedBytes: 3 * 1024 * 1024, files: 12 },
      }),
    ).toMatchObject({
      actions: ['build', 'not-now'],
      detail:
        'About 12 files waiting · about 3.0 MiB. Building AI Index may take a while and use provider quota. Exact text search remains available.',
      prominent: true,
      title: 'Large AI Index workload',
    });

    const workload = { estimatedBytes: null, files: 1 };
    const partiallyPaused = { partial: true, state: 'paused', workload } as const;
    expect(canSemanticSearch(partiallyPaused)).toBe(true);
    expect(semanticIndexNotice(partiallyPaused)).toMatchObject({
      actions: ['resume', 'not-now'],
      detail:
        'About 1 file waiting. Building AI Index may take a while and use provider quota. Exact text search remains available.',
      title: 'AI Index paused',
    });
    expect(canSemanticSearch({ partial: false, state: 'paused', workload })).toBe(false);
  });

  it('reports progress, failure, and readiness', () => {
    const indexing = { partial: true, remaining: 2, state: 'indexing' } as const;
    expect(canSemanticSearch(indexing)).toBe(true);
    expect(semanticIndexNotice(indexing)?.detail).toBe('2 files remaining.');

    const failed = { state: 'failed', warning: 'daemon died' } as const;
    expect(canSemanticSearch(failed)).toBe(true);
    expect(semanticIndexNotice(failed)).toMatchObject({
      actions: ['retry-index', 'dismiss-warning'],
      detail: 'Search may be incomplete: daemon died',
      persistent: true,
    });
  });

  it('says nothing about an index that is ready or not yet known', () => {
    expect(canSemanticSearch({ state: 'ready' })).toBe(true);
    expect(semanticIndexNotice({ state: 'ready' })).toBeNull();

    expect(canSemanticSearch({ state: 'unknown' })).toBe(false);
    expect(semanticIndexNotice({ state: 'unknown' })).toBeNull();
  });
});

describe('preparation readiness line', () => {
  it('prioritises failures, then blocked media, then progress', () => {
    expect(
      preparationReadinessLine({ blocked: 1, cancelled: 2, failed: 1, pending: 3 }, 9),
    ).toMatchObject({
      detail: '1 failed · 2 cancelled. Open a file to retry it.',
      title: 'Some files could not be prepared for search.',
    });
    expect(
      preparationReadinessLine({ blocked: 2, cancelled: 0, failed: 0, pending: 0 }, 9),
    ).toMatchObject({
      action: 'open-settings',
      detail: '9 files ready to search. 2 media files need transcription setup.',
    });
    expect(
      preparationReadinessLine({ blocked: 0, cancelled: 0, failed: 0, pending: 1 }, 1),
    ).toMatchObject({
      detail: '1 file ready to search. 1 still being prepared.',
      tone: 'progress',
    });
    expect(
      preparationReadinessLine({ blocked: 0, cancelled: 0, failed: 0, pending: 0 }, 4),
    ).toBeNull();
  });
});
