/// <reference lib="webworker" />

import mammoth from 'mammoth';

import { sanitizeDocxHtml } from '@/shared/html-sanitization';

type DocxWorkerResponse = { html: string; ok: true } | { error: string; ok: false };

const workerScope = globalThis as unknown as DedicatedWorkerGlobalScope;

workerScope.addEventListener('message', (event: MessageEvent<{ arrayBuffer: ArrayBuffer }>) => {
  void mammoth
    .convertToHtml(
      { arrayBuffer: event.data.arrayBuffer },
      { convertImage: mammoth.images.dataUri },
    )
    .then((result) => {
      workerScope.postMessage(
        {
          html: sanitizeDocxHtml(result.value),
          ok: true,
        } satisfies DocxWorkerResponse,
        [],
      );
    })
    .catch((error: unknown) => {
      workerScope.postMessage(
        {
          error: error instanceof Error ? error.message : String(error),
          ok: false,
        } satisfies DocxWorkerResponse,
        [],
      );
    });
});
