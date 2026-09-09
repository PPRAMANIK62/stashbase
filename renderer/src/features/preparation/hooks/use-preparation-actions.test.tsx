import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  PreparationError,
  type PreparationControlApi,
} from '@/features/preparation/application/ports';
import { folderStatusQueryKey } from '@/features/preparation/application/queries';

import { usePreparationActions } from './use-preparation-actions';

const source = { folderPath: '/library/research', path: 'papers/report.pdf' };

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function controlApi(overrides: Partial<PreparationControlApi> = {}): PreparationControlApi {
  return {
    cancel: vi.fn(async () => true),
    prepare: vi.fn(async () => undefined),
    reprocess: vi.fn(async () => 'conversion' as const),
    ...overrides,
  };
}

afterEach(cleanup);

describe('preparation actions', () => {
  it('reprocesses then invalidates the folder status instead of guessing state', async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const api = controlApi();
    const hook = renderHook(() => usePreparationActions(api, source), {
      wrapper: wrapper(queryClient),
    });

    await act(() => hook.result.current.reprocess({ language: 'en' }));

    expect(api.reprocess).toHaveBeenCalledWith(source, { language: 'en' }, expect.any(AbortSignal));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: folderStatusQueryKey('/library/research'),
    });
    expect(hook.result.current.pending).toBeNull();
    expect(hook.result.current.error).toBeNull();
  });

  it('shows the server reason when reprocess is blocked and a plain message otherwise', async () => {
    const queryClient = new QueryClient();
    const blocked = controlApi({
      reprocess: vi.fn(async () => {
        throw new PreparationError('blocked', 'Download the transcription model first.');
      }),
    });
    const hook = renderHook(() => usePreparationActions(blocked, source), {
      wrapper: wrapper(queryClient),
    });
    await act(() => hook.result.current.reprocess());
    expect(hook.result.current.error).toBe('Download the transcription model first.');

    const failing = controlApi({
      cancel: vi.fn(async () => {
        throw new PreparationError('unavailable', 'nope');
      }),
    });
    const cancelHook = renderHook(() => usePreparationActions(failing, source), {
      wrapper: wrapper(queryClient),
    });
    await act(() => cancelHook.result.current.cancel());
    expect(cancelHook.result.current.error).toBe('Preparation could not be cancelled.');
  });

  it('ignores unsupported prepare-on-open and aborts in-flight work on unmount', async () => {
    const queryClient = new QueryClient();
    let capturedSignal: AbortSignal | null = null;
    const api = controlApi({
      prepare: vi.fn(async () => {
        throw new PreparationError('unsupported', 'only DOCX and media');
      }),
      reprocess: vi.fn(
        (_source, _options, signal) =>
          new Promise<'conversion'>(() => {
            capturedSignal = signal;
          }),
      ),
    });
    const hook = renderHook(() => usePreparationActions(api, source), {
      wrapper: wrapper(queryClient),
    });

    act(() => hook.result.current.prepare());
    await waitFor(() => expect(api.prepare).toHaveBeenCalled());
    expect(hook.result.current.error).toBeNull();

    act(() => void hook.result.current.reprocess());
    await waitFor(() => expect(capturedSignal).not.toBeNull());
    hook.unmount();
    expect(capturedSignal!.aborted).toBe(true);
  });
});
