import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createDocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';
import type { DocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';
import { documentQueryScope, sourceApi } from '@/test/fakes/documents';

import { useNewTab } from './use-new-tab';

function createRuntime(ids: string[], activeTabId: string | null) {
  return createDocumentTabsRuntime({
    api: sourceApi(),
    createId: () => `tab-${ids.length + 1}`,
    createQueries: () => documentQueryScope(),
    folderPath: '/project/notes',
    generation: 1,
    restored: {
      activeTabId,
      tabs: ids.map((id) => ({ id, source: { folderPath: '/project/notes', path: `${id}.md` } })),
    },
  });
}

const runtimes: DocumentTabsRuntime[] = [];

afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.dispose();
});

describe('useNewTab', () => {
  it('opens from the plus and closes on request', () => {
    const runtime = createRuntime(['a', 'b'], 'b');
    runtimes.push(runtime);
    const { result } = renderHook(() => useNewTab(runtime));

    expect(result.current.open).toBe(false);
    act(() => result.current.add());
    expect(result.current.open).toBe(true);
    act(() => result.current.add());
    expect(result.current.open).toBe(true);
    act(() => result.current.close());
    expect(result.current.open).toBe(false);
  });

  it('closes when a document comes in front, and does not return with the one it opened over', async () => {
    const runtime = createRuntime(['a', 'b'], 'b');
    runtimes.push(runtime);
    const { result } = renderHook(() => useNewTab(runtime));

    act(() => result.current.add());
    await act(async () => {
      await runtime.activate('a');
    });
    expect(result.current.open).toBe(false);
    await act(async () => {
      await runtime.activate('b');
    });
    expect(result.current.open).toBe(false);
  });

  it('outlasts the last document closing, and leaves with the runtime', async () => {
    const runtime = createRuntime(['a'], 'a');
    runtimes.push(runtime);
    const { rerender, result } = renderHook(({ current }) => useNewTab(current), {
      initialProps: { current: runtime as DocumentTabsRuntime | null },
    });

    act(() => result.current.add());
    await act(async () => {
      await runtime.close('a');
    });
    expect(runtime.store.getState().activeTabId).toBeNull();
    expect(result.current.open).toBe(true);

    rerender({ current: null });
    expect(result.current.open).toBe(false);
  });

  it('has nothing to open without a runtime', () => {
    const { result } = renderHook(() => useNewTab(null));
    act(() => result.current.add());
    expect(result.current.open).toBe(false);
  });
});
