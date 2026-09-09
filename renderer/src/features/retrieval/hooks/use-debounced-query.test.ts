import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createTestQueryClient, queryWrapper } from '@/test/query';

import { useDebouncedQuery, type DebouncedQuerySpec } from './use-debounced-query';

const cancelKey = ['test', 'debounced'] as const;

function spec(
  key: string | null,
  fetch: (signal: AbortSignal) => Promise<string>,
  delayMs = 5,
): DebouncedQuerySpec<string> {
  return {
    cancelKey,
    delayMs,
    lane: key === null ? null : { fetch, key: [...cancelKey, key] },
  };
}

function renderDebounced(initial: DebouncedQuerySpec<string>) {
  return renderHook((props: DebouncedQuerySpec<string>) => useDebouncedQuery(props), {
    initialProps: initial,
    wrapper: queryWrapper(createTestQueryClient()),
  });
}

afterEach(() => vi.restoreAllMocks());

describe('useDebouncedQuery', () => {
  it('runs only the lane that outlives the delay', async () => {
    const first = vi.fn(async () => 'first');
    const second = vi.fn(async () => 'second');
    const { rerender, result } = renderDebounced(spec('one', first));

    expect(result.current.isSettling).toBe(true);
    rerender(spec('two', second));

    await waitFor(() => expect(result.current.data).toBe('second'));
    expect(result.current.isSettling).toBe(false);
    expect(first).not.toHaveBeenCalled();
  });

  it('aborts an obsolete request instead of letting its answer land', async () => {
    let pendingSignal: AbortSignal | undefined;
    const stalled = vi.fn((signal: AbortSignal) => {
      pendingSignal ??= signal;
      return new Promise<string>(() => undefined);
    });
    const { rerender, result } = renderDebounced(spec('one', stalled));

    await waitFor(() => expect(stalled).toHaveBeenCalledOnce());
    rerender(
      spec(
        'two',
        vi.fn(async () => 'second'),
      ),
    );

    await waitFor(() => expect(pendingSignal?.aborted).toBe(true));
    await waitFor(() => expect(result.current.data).toBe('second'));
  });

  it('submits the pending lane without waiting out the delay', async () => {
    const fetch = vi.fn(async () => 'now');
    const { result } = renderDebounced(spec('one', fetch, 60_000));

    act(() => result.current.submit());

    await waitFor(() => expect(result.current.data).toBe('now'));
  });

  it('stays idle without a lane', async () => {
    const fetch = vi.fn(async () => 'never');
    const { rerender, result } = renderDebounced(spec('one', fetch));

    await waitFor(() => expect(result.current.data).toBe('never'));
    rerender(spec(null, fetch));

    await waitFor(() => expect(result.current.isSettling).toBe(false));
    expect(result.current.data).toBeUndefined();
    expect(fetch).toHaveBeenCalledOnce();
  });
});
