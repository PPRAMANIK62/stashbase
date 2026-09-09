import { describe, expect, it } from 'vite-plus/test';

import type { SemanticIndexStatus } from '@/shared/domain/folder-index-status';

import { preparationReadinessLine, semanticReadiness } from './semantic-readiness';

function semantic(overrides: Partial<SemanticIndexStatus>): SemanticIndexStatus {
  return {
    available: true,
    disabledReason: null,
    enabled: true,
    estimatedBytes: null,
    indexReady: true,
    pending: [],
    settled: true,
    sourceCount: null,
    state: 'ready',
    warning: null,
    ...overrides,
  };
}

describe('semantic readiness', () => {
  it('explains a missing source and an exhausted allowance without blocking exact search', () => {
    const missing = semanticReadiness(
      semantic({ available: false, enabled: false, state: 'disabled' }),
    );
    expect(missing).toMatchObject({
      canSearch: false,
      detail: 'Exact text search works without AI Index.',
      state: 'not-set-up',
      title: 'Set up AI Index to search by meaning.',
    });
    const quota = semanticReadiness(
      semantic({ available: false, state: 'partial-quota-exhausted' }),
    );
    expect(quota).toMatchObject({ canSearch: false, state: 'quota-exhausted' });
    expect(quota.title).toContain('allowance is exhausted');
  });

  it('offers build and resume decisions with the workload size', () => {
    const awaiting = semanticReadiness(
      semantic({ estimatedBytes: 3 * 1024 * 1024, sourceCount: 12, state: 'awaiting-decision' }),
    );
    expect(awaiting.title).toBe('Large AI Index workload');
    expect(awaiting.detail).toBe(
      'About 12 files waiting · about 3.0 MiB. Building AI Index may take a while and use provider quota. Exact text search remains available.',
    );
    expect(awaiting.actions).toEqual(['build', 'not-now']);
    expect(awaiting.prominent).toBe(true);
    const paused = semanticReadiness(semantic({ sourceCount: 1, state: 'partial-paused' }));
    expect(paused).toMatchObject({
      actions: ['resume', 'not-now'],
      canSearch: true,
      title: 'AI Index paused',
    });
    expect(semanticReadiness(semantic({ sourceCount: 1, state: 'paused' })).canSearch).toBe(false);
  });

  it('reports progress, failure, and readiness', () => {
    expect(
      semanticReadiness(semantic({ pending: ['a.md', 'b.md'], state: 'partial-indexing' })),
    ).toMatchObject({
      canSearch: true,
      detail: '2 files remaining.',
      state: 'indexing',
    });
    expect(
      semanticReadiness(
        semantic({ state: 'failed', warning: { at: 'now', message: 'daemon died' } }),
      ),
    ).toMatchObject({
      actions: ['retry-index', 'dismiss-warning'],
      detail: 'Search may be incomplete: daemon died',
      state: 'failed',
    });
    expect(semanticReadiness(semantic({}))).toMatchObject({
      canSearch: true,
      state: 'ready',
      title: null,
    });
    expect(semanticReadiness(null).state).toBe('unknown');
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
