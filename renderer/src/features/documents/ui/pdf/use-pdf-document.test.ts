import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { usePdfDocument, type PdfLoadTask } from './use-pdf-document';

afterEach(cleanup);

function pendingTask(): PdfLoadTask {
  return { destroy: vi.fn(async () => undefined), promise: new Promise(() => undefined) };
}

describe('PDF document lifecycle', () => {
  it('destroys the old loading task when the versioned URL changes', () => {
    const first = pendingTask();
    const second = pendingTask();
    const load = vi.fn((url: string) => (url.endsWith('v=1') ? first : second));
    const hook = renderHook(({ url }) => usePdfDocument(url, load), {
      initialProps: { url: 'http://127.0.0.1/asset/paper.pdf?v=1' },
    });

    hook.rerender({ url: 'http://127.0.0.1/asset/paper.pdf?v=2' });
    expect(first.destroy).toHaveBeenCalledOnce();
    hook.unmount();
    expect(second.destroy).toHaveBeenCalledOnce();
  });

  it('rejects late document completion after disposal', async () => {
    let resolveDocument: ((value: never) => void) | undefined;
    const task = {
      destroy: vi.fn(async () => undefined),
      promise: new Promise<never>((resolve) => {
        resolveDocument = resolve;
      }),
    };
    const document = { destroy: vi.fn(async () => undefined) };
    const load = vi.fn(() => task);
    const hook = renderHook(() => usePdfDocument('http://127.0.0.1/paper.pdf?v=1', load));
    hook.unmount();
    resolveDocument?.(document as never);

    await waitFor(() => expect(document.destroy).toHaveBeenCalledOnce());
  });
});
