import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { failureMessage } from '@/features/settings/application/failure-messages';
import { capturePort } from '@/test/fakes/settings';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { CAPTURE_APPLY_WARNING, useCapture } from './use-capture';

afterEach(cleanup);

describe('useCapture', () => {
  it('saves optimistically and warns when the desktop watch does not apply', async () => {
    const port = capturePort();
    const applyWatch = vi.fn(async () => false);
    const hook = renderHook(() => useCapture(port, applyWatch), {
      wrapper: queryWrapper(createTestQueryClient()),
    });
    await waitFor(() => expect(hook.result.current.disabled).toBe(false));

    act(() => hook.result.current.setClipboardImageImport(true));

    await waitFor(() => expect(hook.result.current.clipboardImageImport).toBe(true));
    expect(port.update).toHaveBeenCalledWith(
      { clipboardImageImport: true },
      expect.any(AbortSignal),
    );
    expect(applyWatch).toHaveBeenCalledWith(true);
    await waitFor(() => expect(hook.result.current.warning).toBe(CAPTURE_APPLY_WARNING));
  });

  it('reverts and re-applies the previous watch when the save fails', async () => {
    const port = capturePort({
      update: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    const applyWatch = vi.fn(async () => true);
    const hook = renderHook(() => useCapture(port, applyWatch), {
      wrapper: queryWrapper(createTestQueryClient()),
    });
    await waitFor(() => expect(hook.result.current.disabled).toBe(false));

    act(() => hook.result.current.setClipboardImageImport(true));

    await waitFor(() =>
      expect(hook.result.current.failure).toEqual({
        message: failureMessage('unavailable'),
        tone: 'capability',
      }),
    );
    expect(hook.result.current.clipboardImageImport).toBe(false);
    expect(applyWatch).toHaveBeenCalledWith(false);
  });
});
