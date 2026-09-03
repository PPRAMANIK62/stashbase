import { describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentNavigationRuntime } from './navigation-runtime';

describe('document navigation runtime', () => {
  it('keeps Find registration active-tab-owned and restores a retained query', async () => {
    const runtime = createDocumentNavigationRuntime('one');
    const first = {
      close: vi.fn(),
      next: vi.fn(() => ({ current: 2, total: 3 })),
      previous: vi.fn(() => ({ current: 3, total: 3 })),
      restoreQuery: vi.fn(() => ({ current: 1, total: 3 })),
      setQuery: vi.fn(() => ({ current: 1, total: 3 })),
    };
    const releaseFirst = runtime.claimFind('one', Symbol('one'), first);
    expect(runtime.openFind()).toBe(true);
    runtime.setFindQuery('plan');
    await vi.waitFor(() => expect(runtime.store.getState().find.total).toBe(3));

    runtime.activate('two');
    expect(first.close).toHaveBeenCalledOnce();
    const second = {
      ...first,
      close: vi.fn(),
      restoreQuery: vi.fn(() => ({ current: 1, total: 1 })),
    };
    runtime.claimFind('two', Symbol('two'), second);
    await vi.waitFor(() =>
      expect(second.restoreQuery).toHaveBeenCalledWith('plan', expect.anything()),
    );
    releaseFirst();

    expect(runtime.store.getState().find.available).toBe(true);
    expect(runtime.store.getState().find.query).toBe('plan');
  });

  it('scopes outline selection and pending anchors to the active tab', () => {
    const runtime = createDocumentNavigationRuntime('one');
    const owner = Symbol('outline');
    const select = vi.fn();
    const heading = { id: 'part', level: 2, position: 10, text: 'Part' };
    runtime.claimOutline('one', owner);
    runtime.publishOutline('one', owner, { activeId: 'part', headings: [heading] }, select);
    runtime.selectHeading(heading);
    runtime.requestAnchor('one', 'part');

    expect(select).toHaveBeenCalledWith(heading);
    expect(runtime.store.getState().pendingAnchor).toEqual({ id: 'part', tabId: 'one' });
    runtime.consumeAnchor('two', 'part');
    expect(runtime.store.getState().pendingAnchor).not.toBeNull();
    runtime.consumeAnchor('one', 'part');
    expect(runtime.store.getState().pendingAnchor).toBeNull();
  });
});
