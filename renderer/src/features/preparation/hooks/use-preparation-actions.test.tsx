import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { PreparationError } from '@/features/preparation/application/ports';
import { preparationQueryKeys } from '@/features/preparation/application/queries';
import { preparationControlApi as controlApi } from '@/test/fakes/preparation';
import { RESEARCH_FOLDER } from '@/test/fakes/workspace';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { usePreparationActions } from './use-preparation-actions';

const source = { folderPath: RESEARCH_FOLDER.path, path: 'papers/report.pdf' };

afterEach(cleanup);

describe('preparation actions', () => {
  it('reprocesses then invalidates the folder status instead of guessing state', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const api = controlApi();
    const hook = renderHook(() => usePreparationActions(api, source), {
      wrapper: queryWrapper(queryClient),
    });

    await act(() => hook.result.current.reprocess({ language: 'en' }));

    expect(api.reprocess).toHaveBeenCalledWith(source, { language: 'en' }, expect.any(AbortSignal));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: preparationQueryKeys.folderStatus(RESEARCH_FOLDER.path),
    });
    expect(hook.result.current.pending).toBeNull();
    expect(hook.result.current.error).toBeNull();
  });

  it('keeps the daemon’s own sentence when setup is blocked', async () => {
    const queryClient = createTestQueryClient();
    // The transport seam carries the server's sentence as the failure's cause;
    // only that sentence names the missing setup step.
    const blocked = controlApi({
      reprocess: vi.fn(async () => {
        throw new PreparationError('blocked', 'Transcription is not set up.', {
          cause: new Error('Download the transcription model first.'),
        });
      }),
    });
    const hook = renderHook(() => usePreparationActions(blocked, source), {
      wrapper: queryWrapper(queryClient),
    });

    await act(() => hook.result.current.reprocess());
    expect(hook.result.current.error).toBe('Download the transcription model first.');
  });

  it('explains every other refusal by its kind rather than by its message', async () => {
    const queryClient = createTestQueryClient();
    // Blocked without a server sentence still falls back to the mapped line.
    const blocked = controlApi({
      reprocess: vi.fn(async () => {
        throw new PreparationError('blocked', 'Download the transcription model first.');
      }),
    });
    const hook = renderHook(() => usePreparationActions(blocked, source), {
      wrapper: queryWrapper(queryClient),
    });
    await act(() => hook.result.current.reprocess());
    expect(hook.result.current.error).toBe(
      'Transcription setup is required before this file can be prepared.',
    );

    // A server sentence on any other kind is a cause, not a recovery.
    const failing = controlApi({
      cancel: vi.fn(async () => {
        throw new PreparationError('unavailable', 'nope', { cause: new Error('daemon exploded') });
      }),
    });
    const cancelHook = renderHook(() => usePreparationActions(failing, source), {
      wrapper: queryWrapper(queryClient),
    });
    await act(() => cancelHook.result.current.cancel());
    expect(cancelHook.result.current.error).toBe('Preparation is unavailable. Try again.');

    const thrown = controlApi({
      cancel: vi.fn(async () => {
        throw new Error('not a preparation failure at all');
      }),
    });
    const thrownHook = renderHook(() => usePreparationActions(thrown, source), {
      wrapper: queryWrapper(queryClient),
    });
    await act(() => thrownHook.result.current.cancel());
    expect(thrownHook.result.current.error).toBe('Preparation is unavailable. Try again.');
  });

  it('ignores unsupported prepare-on-open and aborts in-flight work on unmount', async () => {
    const queryClient = createTestQueryClient();
    const inFlight: { signal: AbortSignal | null } = { signal: null };
    const api = controlApi({
      prepare: vi.fn(async () => {
        throw new PreparationError('unsupported', 'only DOCX and media');
      }),
      reprocess: vi.fn(
        (_source, _options, signal) =>
          new Promise<'conversion'>(() => {
            inFlight.signal = signal;
          }),
      ),
    });
    const hook = renderHook(() => usePreparationActions(api, source), {
      wrapper: queryWrapper(queryClient),
    });

    act(() => hook.result.current.prepare());
    await waitFor(() => expect(api.prepare).toHaveBeenCalled());
    expect(hook.result.current.error).toBeNull();

    act(() => void hook.result.current.reprocess());
    await waitFor(() => expect(inFlight.signal).not.toBeNull());
    hook.unmount();
    expect(inFlight.signal?.aborted).toBe(true);
  });
});
