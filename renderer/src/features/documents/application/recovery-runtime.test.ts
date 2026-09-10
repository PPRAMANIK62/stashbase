import { describe, expect, it, vi } from 'vite-plus/test';

import { recoveryApi } from '@/test/fakes/documents';

import type { DocumentRestoreOutcome } from './document-runtime';
import { RecoveryDraftError, type RecoveryDraftPort } from './ports';
import { createRecoveryRuntime } from './recovery-runtime';

const folderPath = '/library/notes';
const plan = { folderPath, path: 'plan.md' };
const notes = { folderPath, path: 'notes.md' };

function listing(overrides: Partial<RecoveryDraftPort> = {}) {
  return recoveryApi({
    list: vi.fn(async () => ({
      available: true as const,
      drafts: [
        {
          currentVersion: 'v1',
          expectedVersion: 'v1',
          savedAt: '2026-09-09T08:00:00.000Z',
          source: notes,
        },
        {
          currentVersion: 'v2',
          expectedVersion: 'v1',
          savedAt: '2026-09-10T08:00:00.000Z',
          source: plan,
        },
      ],
    })),
    read: vi.fn(async (source) => ({
      content: `# ${source.path}`,
      currentVersion: 'v2',
      expectedVersion: 'v1',
      savedAt: '2026-09-10T08:00:00.000Z',
      source,
    })),
    ...overrides,
  });
}

function harness(api = listing(), outcome: DocumentRestoreOutcome = 'restored') {
  const restoreInto = vi.fn(async () => outcome);
  const runtime = createRecoveryRuntime({ api, folderPath, restoreInto });
  return { api, restoreInto, runtime };
}

describe('recovery runtime', () => {
  it('lists the folder newest first with staleness derived from the versions', async () => {
    const { runtime } = harness();
    expect(runtime.store.getState().status).toBe('loading');
    await runtime.refresh();
    expect(runtime.store.getState()).toMatchObject({
      candidates: [
        { source: plan, staleness: 'changed' },
        { source: notes, staleness: 'current' },
      ],
      failure: null,
      pending: {},
      status: 'ready',
    });
  });

  it('names a disabled journal and a failed listing without inventing drafts', async () => {
    const disabled = harness(
      recoveryApi({
        list: vi.fn(async () => ({ available: false as const, reason: 'no-key' as const })),
      }),
    );
    await disabled.runtime.refresh();
    expect(disabled.runtime.store.getState()).toMatchObject({
      candidates: [],
      status: 'unavailable',
    });

    const failed = harness(
      recoveryApi({
        list: vi.fn(async () => {
          throw new RecoveryDraftError('unavailable', 'The recovery journal could not be reached.');
        }),
      }),
    );
    await failed.runtime.refresh();
    expect(failed.runtime.store.getState()).toMatchObject({
      candidates: [],
      failure: { message: 'The recovery journal could not be reached.', tone: 'capability' },
      status: 'failed',
    });
  });

  it('restores a draft into its document and leaves the entry to the journalist', async () => {
    const { api, restoreInto, runtime } = harness();
    await runtime.refresh();
    const [candidate] = runtime.store.getState().candidates;
    if (!candidate) throw new Error('missing candidate');

    const decision = runtime.restore(candidate);
    expect(runtime.store.getState().pending).toEqual({
      [JSON.stringify([folderPath, 'plan.md'])]: 'restore',
    });
    await expect(decision).resolves.toBe(true);
    expect(restoreInto).toHaveBeenCalledWith(plan, { content: '# plan.md', expectedVersion: 'v1' });
    expect(api.discard).not.toHaveBeenCalled();
    expect(runtime.store.getState()).toMatchObject({
      candidates: [{ source: notes }],
      pending: {},
    });
  });

  it('discards the entry when the draft already matches the disk', async () => {
    const { api, runtime } = harness(listing(), 'unchanged');
    await runtime.refresh();
    const [candidate] = runtime.store.getState().candidates;
    if (!candidate) throw new Error('missing candidate');
    await expect(runtime.restore(candidate)).resolves.toBe(true);
    expect(api.discard).toHaveBeenCalledWith(plan, expect.any(AbortSignal));
    expect(runtime.store.getState().candidates).toHaveLength(1);
  });

  it('keeps a refused restore in the list with a sentence the reader can act on', async () => {
    const { runtime } = harness(listing(), 'refused');
    await runtime.refresh();
    const [candidate] = runtime.store.getState().candidates;
    if (!candidate) throw new Error('missing candidate');
    await expect(runtime.restore(candidate)).resolves.toBe(false);
    expect(runtime.store.getState()).toMatchObject({
      candidates: [{ source: plan }, { source: notes }],
      failure: {
        message: 'plan.md could not take the draft. Open it and try again.',
        tone: 'capability',
      },
      pending: {},
    });
  });

  it('drops a draft that is already gone and reports other refusals', async () => {
    const gone = harness(
      listing({
        read: vi.fn(async () => {
          throw new RecoveryDraftError('not-found', 'gone');
        }),
      }),
    );
    await gone.runtime.refresh();
    const [first] = gone.runtime.store.getState().candidates;
    if (!first) throw new Error('missing candidate');
    await expect(gone.runtime.restore(first)).resolves.toBe(true);
    expect(gone.runtime.store.getState().candidates).toHaveLength(1);

    const refused = harness(
      listing({
        discard: vi.fn(async () => {
          throw new RecoveryDraftError('unauthorized', 'no');
        }),
      }),
    );
    await refused.runtime.refresh();
    const [candidate] = refused.runtime.store.getState().candidates;
    if (!candidate) throw new Error('missing candidate');
    await expect(refused.runtime.discard(candidate)).resolves.toBe(false);
    expect(refused.runtime.store.getState()).toMatchObject({
      candidates: [{ source: plan }, { source: notes }],
      failure: { message: 'This window can no longer use the recovery journal.' },
    });
  });

  it('discards every listed draft one by one and ignores a repeated decision', async () => {
    const { api, runtime } = harness();
    await runtime.refresh();
    const [candidate] = runtime.store.getState().candidates;
    if (!candidate) throw new Error('missing candidate');
    const first = runtime.discard(candidate);
    await expect(runtime.discard(candidate)).resolves.toBe(false);
    await expect(first).resolves.toBe(true);

    await expect(runtime.discardAll()).resolves.toBe(true);
    expect(api.discard).toHaveBeenCalledTimes(2);
    expect(runtime.store.getState().candidates).toEqual([]);
  });

  it('refuses every completion after dispose', async () => {
    const { runtime } = harness();
    const refresh = runtime.refresh();
    runtime.dispose();
    await refresh;
    expect(runtime.store.getState().status).toBe('loading');
    await expect(
      runtime.discard({ expectedVersion: 'v1', savedAt: '', source: plan, staleness: 'current' }),
    ).resolves.toBe(false);
  });
});
