import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { CapturePort } from '@/features/settings/application/ports';

import { CAPTURE_APPLY_WARNING, useCapture } from './use-capture';

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

afterEach(cleanup);

describe('useCapture', () => {
  it('saves optimistically and warns when the desktop watch does not apply', async () => {
    const port: CapturePort = {
      load: vi.fn(async () => ({ clipboardImageImport: false })),
      update: vi.fn(async (next) => next),
    };
    const applyWatch = vi.fn(async () => false);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const hook = renderHook(() => useCapture(port, applyWatch), { wrapper: wrapper(queryClient) });
    await waitFor(() => expect(hook.result.current.preferences.data).toBeDefined());

    await act(async () => {
      await hook.result.current.update.mutateAsync({ clipboardImageImport: true });
    });
    expect(port.update).toHaveBeenCalledWith(
      { clipboardImageImport: true },
      expect.any(AbortSignal),
    );
    expect(applyWatch).toHaveBeenCalledWith(true);
    expect(hook.result.current.preferences.data).toEqual({ clipboardImageImport: true });
    expect(hook.result.current.warning).toBe(CAPTURE_APPLY_WARNING);
  });

  it('reverts and re-applies the previous watch when the save fails', async () => {
    const port: CapturePort = {
      load: vi.fn(async () => ({ clipboardImageImport: false })),
      update: vi.fn(async () => {
        throw new Error('offline');
      }),
    };
    const applyWatch = vi.fn(async () => true);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const hook = renderHook(() => useCapture(port, applyWatch), { wrapper: wrapper(queryClient) });
    await waitFor(() => expect(hook.result.current.preferences.data).toBeDefined());

    await act(async () => {
      await hook.result.current.update
        .mutateAsync({ clipboardImageImport: true })
        .catch(() => undefined);
    });
    expect(hook.result.current.preferences.data).toEqual({ clipboardImageImport: false });
    expect(applyWatch).toHaveBeenCalledWith(false);
  });
});
