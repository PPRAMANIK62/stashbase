import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { DocxPreviewError } from '@/features/documents/application/ports';

import { createDocxPreviewAdapter } from './docx-preview-api';

class FakeWorker {
  readonly listeners = {
    error: new Set<(event: ErrorEvent) => void>(),
    message: new Set<(event: MessageEvent<unknown>) => void>(),
  };
  readonly postMessage = vi.fn((_message: unknown, _transfer: Transferable[]) => undefined);
  readonly terminate = vi.fn();

  addEventListener(type: 'error' | 'message', listener: (event: never) => void) {
    (this.listeners[type] as Set<(event: never) => void>).add(listener);
  }

  dispatchMessage(data: unknown) {
    for (const listener of this.listeners.message) {
      listener(new MessageEvent('message', { data }));
    }
  }

  removeEventListener(type: 'error' | 'message', listener: (event: never) => void) {
    (this.listeners[type] as Set<(event: never) => void>).delete(listener);
  }
}

const resource = {
  fallbackUrl: 'http://127.0.0.1:8090/asset-derived/report.docx?v=one',
  kind: 'docx' as const,
  url: 'http://127.0.0.1:8090/asset/report.docx?v=one',
  version: 'one',
};

afterEach(() => vi.useRealTimers());

describe('DOCX preview API', () => {
  it('transfers source bytes to one worker and returns its sanitized HTML', async () => {
    const worker = new FakeWorker();
    const bytes = new Uint8Array([80, 75, 3, 4]);
    const api = createDocxPreviewAdapter({
      createWorker: () => worker,
      fetchRequest: vi.fn(async () => new Response(bytes, { status: 200 })),
    });
    const result = api.load(resource, new AbortController().signal);
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledOnce());
    const message = worker.postMessage.mock.calls[0]?.[0] as { arrayBuffer: ArrayBuffer };
    const transfer = worker.postMessage.mock.calls[0]?.[1];
    expect(Array.from(new Uint8Array(message.arrayBuffer))).toEqual(Array.from(bytes));
    expect(transfer).toEqual([message.arrayBuffer]);

    worker.dispatchMessage({ html: '<h1>Report</h1>', ok: true });
    await expect(result).resolves.toEqual({ html: '<h1>Report</h1>' });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('terminates conversion on cancellation and classifies malformed worker replies', async () => {
    const cancelledWorker = new FakeWorker();
    const controller = new AbortController();
    const cancelledApi = createDocxPreviewAdapter({
      createWorker: () => cancelledWorker,
      fetchRequest: vi.fn(async () => new Response(new Uint8Array([1]), { status: 200 })),
    });
    const cancelled = cancelledApi.load(resource, controller.signal);
    await vi.waitFor(() => expect(cancelledWorker.postMessage).toHaveBeenCalledOnce());
    controller.abort(new DOMException('closed', 'AbortError'));
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancelledWorker.terminate).toHaveBeenCalledOnce();

    const invalidWorker = new FakeWorker();
    const invalidApi = createDocxPreviewAdapter({
      createWorker: () => invalidWorker,
      fetchRequest: vi.fn(async () => new Response(new Uint8Array([1]), { status: 200 })),
    });
    const invalid = invalidApi.load(resource, new AbortController().signal);
    await vi.waitFor(() => expect(invalidWorker.postMessage).toHaveBeenCalledOnce());
    invalidWorker.dispatchMessage({ ok: true });
    await expect(invalid).rejects.toMatchObject({
      kind: 'invalid-response',
    } satisfies Partial<DocxPreviewError>);
    expect(invalidWorker.terminate).toHaveBeenCalledOnce();
  });

  it('bounds a stalled direct preview independently from preparation', async () => {
    vi.useFakeTimers();
    const api = createDocxPreviewAdapter({
      fetchRequest: vi.fn(
        async (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
              once: true,
            });
          }),
      ),
      timeoutMs: 20_000,
    });
    const pending = api.load(resource, new AbortController().signal);
    const rejection = expect(pending).rejects.toMatchObject({
      kind: 'timeout',
    } satisfies Partial<DocxPreviewError>);

    await vi.advanceTimersByTimeAsync(20_000);
    await rejection;
  });
});
