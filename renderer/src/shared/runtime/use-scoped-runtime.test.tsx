import { cleanup, render, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { useScopedRuntime } from './use-scoped-runtime';

afterEach(cleanup);

interface Runtime {
  key: string;
  serial: number;
}

/** A factory whose runtimes are distinguishable, and a disposer that records. */
function scopedFactory() {
  let serial = 0;
  const disposed: Runtime[] = [];
  const created: Runtime[] = [];
  return {
    created,
    disposed,
    dispose: (runtime: Runtime) => void disposed.push(runtime),
    factory: (key: string) => {
      serial += 1;
      const runtime = { key, serial };
      created.push(runtime);
      return runtime;
    },
  };
}

interface ProbeProps {
  dispose: (runtime: Runtime) => void;
  factory: (key: string) => Runtime;
  seen: (Runtime | null)[];
}

/** Testing Library's `wrapper` option does not reproduce React's remount
 *  simulation, so the StrictMode case mounts this probe inline instead. */
function Probe({ dispose, factory, seen }: ProbeProps) {
  seen.push(useScopedRuntime('folder-a', factory, dispose));
  return null;
}

describe('useScopedRuntime', () => {
  it('has no runtime while there is no scope', () => {
    const { dispose, factory } = scopedFactory();
    const { result } = renderHook(() => useScopedRuntime(null, factory, dispose));

    expect(result.current).toBeNull();
  });

  it('builds one runtime for a key and keeps handing it back', () => {
    const { created, dispose, factory } = scopedFactory();
    const { rerender, result } = renderHook(
      ({ key }: { key: string | null }) => useScopedRuntime(key, factory, dispose),
      { initialProps: { key: 'folder-a' } },
    );

    const runtime = result.current;
    expect(runtime?.key).toBe('folder-a');
    rerender({ key: 'folder-a' });
    expect(result.current).toBe(runtime);
    expect(created).toHaveLength(1);
  });

  it('disposes the old runtime and never returns it once the key changes', () => {
    const { disposed, dispose, factory } = scopedFactory();
    const { rerender, result } = renderHook(
      ({ key }: { key: string | null }) => useScopedRuntime(key, factory, dispose),
      { initialProps: { key: 'folder-a' } },
    );
    const first = result.current;

    rerender({ key: 'folder-b' });

    expect(disposed).toEqual([first]);
    expect(result.current?.key).toBe('folder-b');
    expect(result.current).not.toBe(first);
  });

  it('drops back to null when the scope goes away', () => {
    const { disposed, dispose, factory } = scopedFactory();
    const { rerender, result } = renderHook(
      ({ key }: { key: string | null }) => useScopedRuntime(key, factory, dispose),
      { initialProps: { key: 'folder-a' } as { key: string | null } },
    );
    const first = result.current;

    rerender({ key: null });

    expect(result.current).toBeNull();
    expect(disposed).toEqual([first]);
  });

  it('disposes on unmount', () => {
    const { disposed, dispose, factory } = scopedFactory();
    const { result, unmount } = renderHook(() => useScopedRuntime('folder-a', factory, dispose));
    const runtime = result.current;

    unmount();
    expect(disposed).toEqual([runtime]);
  });

  it('leaves a live runtime behind under a StrictMode double mount', () => {
    const { created, disposed, dispose, factory } = scopedFactory();
    const seen: (Runtime | null)[] = [];

    render(
      <StrictMode>
        <Probe dispose={dispose} factory={factory} seen={seen} />
      </StrictMode>,
    );

    expect(created).toHaveLength(2);
    expect(disposed).toEqual([created[0]]);
    expect(seen.at(-1)).toBe(created[1]);
  });

  it('reads the current factory without rebuilding the runtime', () => {
    const { dispose, factory } = scopedFactory();
    const replacement = vi.fn(factory);
    const { rerender, result } = renderHook(
      ({ make }: { make: (key: string) => Runtime }) => useScopedRuntime('folder-a', make, dispose),
      { initialProps: { make: factory } },
    );
    const runtime = result.current;

    rerender({ make: replacement });

    expect(replacement).not.toHaveBeenCalled();
    expect(result.current).toBe(runtime);
  });
});
