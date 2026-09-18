import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type {
  DocumentRevisionProposal,
  DrainedRevisions,
} from '@/features/documents/application/ports';
import { revisionsApi } from '@/test/fakes/documents';

import { useRevisionProposals } from './use-revision-proposals';

const folderPath = '/project/notes';

afterEach(() => {
  vi.useRealTimers();
});

function proposal(path: string): DocumentRevisionProposal {
  return {
    id: 'proposal-1',
    baseVersion: 'sha256:v1',
    content: '# Revised\n',
    createdAt: 0,
    origin: { kind: 'agent' },
    source: { folderPath, path },
  };
}

function drainOf(
  proposals: DocumentRevisionProposal[],
  unresolved: string[] = [],
): DrainedRevisions {
  return { proposals, unresolved };
}

describe('polling for parked revisions', () => {
  it('drains nothing until a folder is open', () => {
    const api = revisionsApi();
    renderHook(() => useRevisionProposals(api, null, vi.fn(), vi.fn()));
    expect(api.drain).not.toHaveBeenCalled();
  });

  it('hands over what one drain returned, and stays quiet on an empty one', async () => {
    const drained = [proposal('plan.md')];
    const api = revisionsApi({ drain: vi.fn(async () => drainOf(drained.splice(0))) });
    const onProposals = vi.fn();

    renderHook(() => useRevisionProposals(api, folderPath, onProposals, vi.fn()));

    await waitFor(() => expect(onProposals).toHaveBeenCalledWith(drainOf([proposal('plan.md')])));
    expect(onProposals).toHaveBeenCalledTimes(1);
  });

  it('hands over a proposal it could not resolve, which the drain consumed anyway', async () => {
    const unresolved = ['secret.md'];
    const api = revisionsApi({ drain: vi.fn(async () => drainOf([], unresolved.splice(0))) });
    const onProposals = vi.fn();

    renderHook(() => useRevisionProposals(api, folderPath, onProposals, vi.fn()));

    await waitFor(() => expect(onProposals).toHaveBeenCalledWith(drainOf([], ['secret.md'])));
  });

  it('never runs two drains at once, however long one takes', async () => {
    vi.useFakeTimers();
    const answered: Array<(drained: DrainedRevisions) => void> = [];
    const drain = vi.fn(() => new Promise<DrainedRevisions>((resolve) => answered.push(resolve)));

    renderHook(() => useRevisionProposals(revisionsApi({ drain }), folderPath, vi.fn(), vi.fn()));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(drain).toHaveBeenCalledTimes(1);

    answered[0]?.(drainOf([]));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(drain).toHaveBeenCalledTimes(2);
  });

  it('reports an uncertain drain and keeps polling', async () => {
    vi.useFakeTimers();
    const drain = vi.fn(async () => Promise.reject(new Error('offline')));
    const onFailure = vi.fn();

    renderHook(() => useRevisionProposals(revisionsApi({ drain }), folderPath, vi.fn(), onFailure));
    await vi.advanceTimersByTimeAsync(4_000);

    expect(drain.mock.calls.length).toBeGreaterThan(1);
    expect(onFailure).toHaveBeenCalledWith(folderPath);
  });

  it('follows a changed callback without restarting the interval', async () => {
    vi.useFakeTimers();
    const drain = vi.fn(async () => drainOf([proposal('plan.md')]));
    const api = revisionsApi({ drain });
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = renderHook(
      ({ onProposals }: { onProposals: () => void }) =>
        useRevisionProposals(api, folderPath, onProposals, vi.fn()),
      { initialProps: { onProposals: first } },
    );
    await vi.advanceTimersByTimeAsync(0);
    rerender({ onProposals: second });
    await vi.advanceTimersByTimeAsync(2_000);

    expect(drain).toHaveBeenCalledTimes(2);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('does not deliver a consumed response into a different folder after a switch', async () => {
    let answer!: (drained: DrainedRevisions) => void;
    const first = new Promise<DrainedRevisions>((resolve) => {
      answer = resolve;
    });
    const drain = vi.fn((folder: string) =>
      folder === folderPath ? first : Promise.resolve(drainOf([])),
    );
    const delivered = vi.fn();
    const failed = vi.fn();
    const api = revisionsApi({ drain });
    const { rerender } = renderHook(
      ({ folder }: { folder: string }) => useRevisionProposals(api, folder, delivered, failed),
      { initialProps: { folder: folderPath } },
    );
    rerender({ folder: '/project/other' });
    answer(drainOf([proposal('plan.md')]));

    await waitFor(() => expect(failed).toHaveBeenCalledWith(folderPath));
    expect(delivered).not.toHaveBeenCalled();
    expect(drain).toHaveBeenCalledWith('/project/other', expect.any(AbortSignal));
  });
});
