import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { exitFallbackMs, spring } from './springs';
import { useDeferredUnmount } from './use-deferred-unmount';

/** The slice of a Base UI root's `actionsRef` payload the hook drives. */
interface Popup {
  unmount: () => void;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** An open popup whose portal teardown is recorded rather than performed. */
function openPopup(tier: { exit: { duration: number } }) {
  const toreDown = vi.fn();
  const view = renderHook(({ open }) => useDeferredUnmount<Popup>(open, tier), {
    initialProps: { open: true },
  });
  view.result.current.actionsRef.current = { unmount: toreDown };
  return { close: () => view.rerender({ open: false }), toreDown, view };
}

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('useDeferredUnmount', () => {
  it('keeps an open popup mounted however long it stays open', () => {
    const { toreDown, view } = openPopup(spring.moderate);

    advance(exitFallbackMs(spring.moderate) * 10);
    expect(toreDown).not.toHaveBeenCalled();

    // An exit callback can still arrive from a previous close; while the popup
    // is open it must not tear the current one down.
    act(() => view.result.current.releaseOnExit());
    expect(toreDown).not.toHaveBeenCalled();
  });

  it('tears down as soon as the exit animation reports back', () => {
    const { close, toreDown, view } = openPopup(spring.moderate);

    close();
    act(() => view.result.current.releaseOnExit());
    expect(toreDown).toHaveBeenCalledTimes(1);
  });

  it("falls back to the closing tier's own exit duration when the animation stalls", () => {
    for (const tier of [spring.fast, spring.slow]) {
      const { close, toreDown } = openPopup(tier);
      close();

      advance(exitFallbackMs(tier) - 1);
      expect(toreDown).not.toHaveBeenCalled();

      advance(1);
      expect(toreDown).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });

  it('cancels the fallback when the popup reopens', () => {
    const { close, toreDown, view } = openPopup(spring.slow);

    close();
    advance(exitFallbackMs(spring.slow) - 1);
    view.rerender({ open: true });
    advance(exitFallbackMs(spring.slow) * 2);

    expect(toreDown).not.toHaveBeenCalled();
  });
});
