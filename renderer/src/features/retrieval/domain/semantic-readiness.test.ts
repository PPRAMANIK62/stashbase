import { describe, expect, it } from 'vite-plus/test';

import {
  canSemanticSearch,
  preparationReadinessLine,
  semanticIndexNotice,
} from './semantic-readiness';

describe('semantic readiness', () => {
  it('says nothing about a missing BYOK source', () => {
    // Not set up is not a state the reader is told about: the mode is not
    // offered until it is turned on in Settings, so there is no notice to show.
    const missing = { state: 'not-set-up' } as const;
    expect(canSemanticSearch(missing)).toBe(false);
    expect(semanticIndexNotice(missing)).toBeNull();
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
