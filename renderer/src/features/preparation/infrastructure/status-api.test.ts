import { describe, expect, it, vi } from 'vite-plus/test';

import { PreparationError } from '@/features/preparation/application/ports';
import type { HttpClient } from '@/platform/http/client';

import { createPreparationStatusApi } from './status-api';

const wire = {
  blockedConversions: [],
  conversionProgress: { 'a.pdf': { lane: 'heavy', phase: 'queued', tasksAhead: 1 } },
  conversionRevision: 3,
  conversionVersions: {},
  folder: '/library/research',
  indexReady: true,
  indexWarning: { at: '2026-09-09T00:00:00.000Z', message: 'daemon restarted' },
  indexed: 2,
  orphaned: [],
  orphanedCount: 0,
  pending: ['notes.md'],
  pendingConversions: ['a.pdf'],
  pendingCount: 1,
  preparationFailures: [],
  semanticAvailable: true,
  semanticEnabled: true,
  semanticIndexing: { estimatedBytes: 2048, sourceCount: 4, state: 'awaiting-decision' },
  total: 5,
  treeVersion: 9,
  upToDate: false,
  visibleIndexingSettled: true,
};

describe('preparation status API', () => {
  it('requests the explicit folder and maps the semantic block', async () => {
    const request = vi.fn(async () => ({ body: wire, status: 200 }));
    const status = await createPreparationStatusApi({ request }).load(
      '/library/research',
      new AbortController().signal,
    );
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/index-status?folder=%2Flibrary%2Fresearch' }),
    );
    expect(status.conversionProgress['a.pdf']?.phase).toBe('queued');
    expect(status.semantic).toMatchObject({
      estimatedBytes: 2048,
      pending: ['notes.md'],
      sourceCount: 4,
      state: 'awaiting-decision',
      warning: { message: 'daemon restarted' },
    });
  });

  it('classifies a lost folder scope and an invalid body', async () => {
    const lost: HttpClient = {
      request: vi.fn(async () => ({
        body: { code: 'NO_FOLDER', error: 'no folder' },
        status: 412,
      })),
    };
    await expect(
      createPreparationStatusApi(lost).load('/library/x', new AbortController().signal),
    ).rejects.toMatchObject({ kind: 'scope-lost' });
    const invalid: HttpClient = {
      request: vi.fn(async () => ({ body: { nope: true }, status: 200 })),
    };
    await expect(
      createPreparationStatusApi(invalid).load('/library/x', new AbortController().signal),
    ).rejects.toBeInstanceOf(PreparationError);
  });
});
