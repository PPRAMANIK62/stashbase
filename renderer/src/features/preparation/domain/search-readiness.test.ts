import { describe, expect, it } from 'vite-plus/test';

import { folderIndexStatus } from '@/test/fakes/preparation';

import { folderSearchReadiness } from './search-readiness';

describe('folder search readiness', () => {
  it('answers unknown for a folder whose status has not arrived', () => {
    const readiness = folderSearchReadiness(null);

    expect(readiness.semantic).toEqual({ state: 'unknown' });
    expect(readiness.readyCount).toBe(0);
    expect(readiness.counts).toEqual({
      blocked: 0,
      cancelled: 0,
      failed: 0,
      needsAttention: false,
      pending: 0,
    });
  });

  it('counts as ready only the sources neither pending nor blocked', () => {
    const readiness = folderSearchReadiness(
      folderIndexStatus({
        blockedConversions: ['talk.m4a'],
        pendingConversions: ['study.pdf', 'paper.pdf'],
        total: 9,
      }),
    );

    expect(readiness.counts).toMatchObject({ blocked: 1, pending: 2 });
    expect(readiness.readyCount).toBe(6);
  });

  it('carries each index state with exactly the facts that state has', () => {
    expect(
      folderSearchReadiness(
        folderIndexStatus({
          semantic: { partial: false, state: 'paused', workload: { estimatedBytes: 1, files: 2 } },
        }),
      ).semantic,
    ).toEqual({ partial: false, state: 'paused', workload: { estimatedBytes: 1, files: 2 } });

    expect(
      folderSearchReadiness(
        folderIndexStatus({
          indexWarning: { at: 'now', sentence: 'daemon restarted' },
          semantic: { state: 'failed' },
        }),
      ).semantic,
    ).toEqual({ state: 'failed', warning: 'daemon restarted' });
  });

  it('treats a failed index with no warning as one with nothing to say', () => {
    const readiness = folderSearchReadiness(folderIndexStatus({ semantic: { state: 'failed' } }));

    expect(readiness.semantic).toEqual({ state: 'ready' });
    expect(readiness.counts.needsAttention).toBe(false);
  });
});
