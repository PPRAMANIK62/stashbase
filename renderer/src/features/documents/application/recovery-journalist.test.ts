import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  documentTabsRuntimeOptions,
  recoveryApi,
  sourceApi,
  textSource,
} from '@/test/fakes/documents';

import { RecoveryDraftError, type RecoveryDraftPort } from './ports';
import {
  createRecoveryJournalist,
  RECOVERY_JOURNAL_DELAY_MS,
  RECOVERY_JOURNAL_MAX_DELAY_MS,
} from './recovery-journalist';
import { createDocumentTabsRuntime } from './tabs-runtime';

const source = { folderPath: '/library/notes', path: 'plan.md' };
const notYet = () => undefined;

function harness(api: RecoveryDraftPort = recoveryApi()) {
  const save = vi.fn(async (_source: unknown, input: { content: string }) =>
    textSource({ content: input.content, version: 'v2' }),
  );
  const tabs = createDocumentTabsRuntime(
    documentTabsRuntimeOptions({
      api: sourceApi({ save }),
      restored: { activeTabId: 'tab-1', tabs: [{ id: 'tab-1', source }] },
    }),
  );
  const journalist = createRecoveryJournalist({ api, tabs });
  const document = tabs.getDocument('tab-1');
  if (!document) throw new Error('missing document');
  document.reconcile(textSource({ content: 'disk', version: 'v1' }));
  return { api, document, journalist, tabs };
}

describe('recovery journalist', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes one coalesced snapshot after the pause and clears it once the save lands', async () => {
    const { api, document, journalist } = harness();
    document.change('dra');
    document.change('draft');
    expect(journalist.state().documents['tab-1']?.phase).toBe('pending');
    await vi.advanceTimersByTimeAsync(RECOVERY_JOURNAL_DELAY_MS - 1);
    expect(api.write).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(api.write).toHaveBeenCalledTimes(1);
    expect(api.write).toHaveBeenCalledWith(
      { content: 'draft', expectedVersion: 'v1', source },
      expect.any(AbortSignal),
    );
    expect(journalist.state().documents['tab-1']?.phase).toBe('journaled');

    await vi.advanceTimersByTimeAsync(RECOVERY_JOURNAL_DELAY_MS);
    expect(api.write).toHaveBeenCalledTimes(1);

    await document.save(
      sourceApi({ save: vi.fn(async () => textSource({ content: 'draft', version: 'v2' })) }),
    );
    expect(api.discard).toHaveBeenCalledWith(source, expect.any(AbortSignal));
    await vi.advanceTimersByTimeAsync(0);
    expect(journalist.state().documents['tab-1']?.phase).toBe('clean');
    journalist.dispose();
  });

  it('never lets a continuous edit go longer than the max delay unjournaled', async () => {
    const { api, document, journalist } = harness();
    let text = '';
    for (let tick = 0; tick < 6; tick += 1) {
      text += 'x';
      document.change(text);
      await vi.advanceTimersByTimeAsync(1_000);
    }
    expect(api.write).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.write).mock.calls[0]?.[0]).toMatchObject({ content: 'xxxxx' });
    expect(RECOVERY_JOURNAL_MAX_DELAY_MS).toBeLessThan(6_000);
    journalist.dispose();
  });

  it('clears an entry when text becomes clean before any snapshot was written', async () => {
    const { api, document, journalist } = harness();
    document.change('draft');
    document.change('disk');
    await vi.advanceTimersByTimeAsync(0);
    expect(api.write).not.toHaveBeenCalled();
    expect(api.discard).toHaveBeenCalledTimes(1);
    journalist.dispose();
  });

  it('records a failure once per text and retries on the next change', async () => {
    const write = vi
      .fn<RecoveryDraftPort['write']>()
      .mockRejectedValueOnce(
        new RecoveryDraftError('unavailable', 'The recovery journal could not be reached.'),
      );
    write.mockResolvedValue({ savedAt: '2026-09-10T08:00:00.000Z' });
    const { document, journalist } = harness(recoveryApi({ write }));
    document.change('draft');
    await vi.advanceTimersByTimeAsync(RECOVERY_JOURNAL_DELAY_MS);
    expect(write).toHaveBeenCalledTimes(1);
    expect(journalist.state()).toMatchObject({
      documents: { 'tab-1': { failures: 1, phase: 'pending' } },
      lastFailure: 'The recovery journal could not be reached.',
      suspended: false,
    });

    await vi.advanceTimersByTimeAsync(RECOVERY_JOURNAL_MAX_DELAY_MS);
    expect(write).toHaveBeenCalledTimes(1);

    document.change('draft two');
    await vi.advanceTimersByTimeAsync(RECOVERY_JOURNAL_DELAY_MS);
    expect(write).toHaveBeenCalledTimes(2);
    expect(journalist.state().documents['tab-1']?.phase).toBe('journaled');
    journalist.dispose();
  });

  it('stops calling a journal that is disabled on this installation', async () => {
    const write = vi
      .fn<RecoveryDraftPort['write']>()
      .mockRejectedValue(
        new RecoveryDraftError('disabled', 'Draft recovery is unavailable on this installation.'),
      );
    const { api, document, journalist } = harness(recoveryApi({ write }));
    document.change('draft');
    await vi.advanceTimersByTimeAsync(RECOVERY_JOURNAL_DELAY_MS);
    expect(write).toHaveBeenCalledTimes(1);
    expect(journalist.state().suspended).toBe(true);

    document.change('draft two');
    await vi.advanceTimersByTimeAsync(RECOVERY_JOURNAL_MAX_DELAY_MS);
    expect(write).toHaveBeenCalledTimes(1);
    document.change('disk');
    await vi.advanceTimersByTimeAsync(0);
    expect(api.discard).not.toHaveBeenCalled();
    journalist.dispose();
  });

  it('writes again for a change that arrived while a snapshot was in flight', async () => {
    let release: () => void = notYet;
    const write = vi.fn<RecoveryDraftPort['write']>().mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ savedAt: '2026-09-10T08:00:00.000Z' });
        }),
    );
    write.mockResolvedValue({ savedAt: '2026-09-10T08:00:01.000Z' });
    const { document, journalist } = harness(recoveryApi({ write }));
    document.change('draft');
    await vi.advanceTimersByTimeAsync(RECOVERY_JOURNAL_DELAY_MS);
    expect(journalist.state().documents['tab-1']?.phase).toBe('writing');

    document.change('draft two');
    release();
    await vi.advanceTimersByTimeAsync(RECOVERY_JOURNAL_DELAY_MS);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1]?.[0]).toMatchObject({ content: 'draft two' });
    journalist.dispose();
  });

  it('stops watching a closed tab and aborts on dispose', async () => {
    const { api, document, journalist, tabs } = harness();
    document.change('draft');
    await tabs.close('tab-1');
    expect(journalist.state().documents).toEqual({});
    await vi.advanceTimersByTimeAsync(RECOVERY_JOURNAL_MAX_DELAY_MS);
    expect(api.write).not.toHaveBeenCalled();

    const again = harness();
    again.document.change('draft');
    again.journalist.dispose();
    await vi.advanceTimersByTimeAsync(RECOVERY_JOURNAL_MAX_DELAY_MS);
    expect(again.api.write).not.toHaveBeenCalled();
    journalist.dispose();
  });
});
