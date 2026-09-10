import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { PreparationError } from '@/features/preparation/test-support';
import { preparationControlApi } from '@/test/fakes/preparation';
import { RESEARCH_FOLDER } from '@/test/fakes/workspace';

import { usePreparationCommands } from './use-preparation-commands';

afterEach(cleanup);

const notes = { folderPath: RESEARCH_FOLDER.path, path: 'notes.md' };
const slides = { folderPath: RESEARCH_FOLDER.path, path: 'slides.pdf' };

/** A call that stays in flight until the test releases it, so an abort is
 *  observable rather than raced. */
function heldCall() {
  const signals: AbortSignal[] = [];
  const call = vi.fn(
    (...args: unknown[]) =>
      new Promise<never>(() => {
        const signal = args.at(-1);
        if (signal instanceof AbortSignal) signals.push(signal);
      }),
  );
  return { call, signals };
}

describe('usePreparationCommands', () => {
  it('starts with nothing to report', () => {
    const { result } = renderHook(() => usePreparationCommands(preparationControlApi()));

    expect(result.current.failure).toBeNull();
  });

  it('turns a refused reprocess into one sentence', async () => {
    const api = preparationControlApi({
      reprocess: vi.fn(() => Promise.reject(new PreparationError('unsupported', 'refused'))),
    });
    const { result } = renderHook(() => usePreparationCommands(api));

    await act(() => result.current.reprocess(notes));

    expect(result.current.failure).toEqual({
      message: 'This file format cannot be prepared.',
      tone: 'input',
    });
  });

  it('reports a refused prepare rather than swallowing it', async () => {
    const api = preparationControlApi({
      prepare: vi.fn(() => Promise.reject(new PreparationError('unavailable', 'refused'))),
    });
    const { result } = renderHook(() => usePreparationCommands(api));

    act(() => result.current.prepare(notes));

    await waitFor(() =>
      expect(result.current.failure).toEqual({
        message: 'Preparation is unavailable. Try again.',
        tone: 'capability',
      }),
    );
  });

  it('lets the reader dismiss the notice', async () => {
    const api = preparationControlApi({
      sync: vi.fn(() => Promise.reject(new PreparationError('unauthorized', 'refused'))),
    });
    const { result } = renderHook(() => usePreparationCommands(api));

    await act(() => result.current.sync(RESEARCH_FOLDER.path));
    expect(result.current.failure).not.toBeNull();

    act(() => result.current.dismissFailure());
    expect(result.current.failure).toBeNull();
  });

  it('replaces an in-flight call on the same source and leaves other sources running', () => {
    const { call, signals } = heldCall();
    const api = preparationControlApi({ reprocess: call });
    const { result } = renderHook(() => usePreparationCommands(api));

    act(() => void result.current.reprocess(notes));
    act(() => void result.current.reprocess(slides));
    act(() => void result.current.reprocess(notes));

    expect(signals.map((signal) => signal.aborted)).toEqual([true, false, false]);
  });

  it('aborts every open call when the shell goes away', () => {
    const { call, signals } = heldCall();
    const api = preparationControlApi({ prepare: call, sync: call });
    const { result, unmount } = renderHook(() => usePreparationCommands(api));

    act(() => result.current.prepare(notes));
    act(() => void result.current.sync(RESEARCH_FOLDER.path));
    unmount();

    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it('says nothing when a call was replaced rather than refused', async () => {
    const refusals: ((error: unknown) => void)[] = [];
    const api = preparationControlApi({
      reprocess: vi.fn(() => new Promise<never>((_resolve, no) => refusals.push(no))),
    });
    const { result } = renderHook(() => usePreparationCommands(api));

    const first = result.current.reprocess(notes);
    act(() => void result.current.reprocess(notes));
    refusals[0]?.(new PreparationError('unavailable', 'refused'));
    await act(() => first);

    expect(result.current.failure).toBeNull();
  });
});
