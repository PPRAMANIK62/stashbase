import { act, cleanup, render, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { useRetainedRuntime } from './use-retained-runtime';

afterEach(cleanup);

interface Runtime {
  id: string;
}

/** The deferred dispose decision is a microtask, so a test has to let the
 *  queue drain before reading it. */
const settle = () => act(async () => undefined);

/** Testing Library's `wrapper` option does not reproduce React's remount
 *  simulation, so the StrictMode cases mount this probe inline instead. */
function Probe({ dispose }: { dispose: (runtime: Runtime) => void }) {
  useRetainedRuntime(() => ({ id: 'runtime' }), dispose);
  return null;
}

describe('useRetainedRuntime', () => {
  it('keeps one runtime across re-renders', () => {
    const { rerender, result } = renderHook(() =>
      useRetainedRuntime(
        () => ({ id: 'runtime' }),
        () => undefined,
      ),
    );
    const runtime = result.current;

    rerender();

    expect(result.current).toBe(runtime);
  });

  it('disposes once the holder really unmounts', async () => {
    const dispose = vi.fn();
    const { result, unmount } = renderHook(() =>
      useRetainedRuntime(() => ({ id: 'runtime' }), dispose),
    );
    const runtime = result.current;

    unmount();
    await settle();

    expect(dispose).toHaveBeenCalledExactlyOnceWith(runtime);
  });

  it('reads the current disposer rather than the one from the first render', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ dispose }: { dispose: (runtime: Runtime) => void }) =>
        useRetainedRuntime(() => ({ id: 'runtime' }), dispose),
      { initialProps: { dispose: first } },
    );

    rerender({ dispose: second });
    unmount();
    await settle();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('survives a StrictMode remount without disposing', async () => {
    const dispose = vi.fn();

    render(
      <StrictMode>
        <Probe dispose={dispose} />
      </StrictMode>,
    );
    await settle();

    expect(dispose).not.toHaveBeenCalled();
  });

  it('still disposes after a StrictMode mount once the holder unmounts', async () => {
    const dispose = vi.fn();
    const view = render(
      <StrictMode>
        <Probe dispose={dispose} />
      </StrictMode>,
    );
    await settle();

    view.unmount();
    await settle();

    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
