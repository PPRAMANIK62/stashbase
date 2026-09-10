/// <reference lib="webworker" />

import mammoth from 'mammoth';

import { sanitizeDocxHtml } from '@/contracts/html-sanitization';

/** A refused conversion answers with the converter's own diagnostic. It is
 *  written for a developer, so it travels as `detail` and reaches the reader
 *  only as the cause behind the preview ladder's sentence. */
type DocxWorkerResponse = { detail: string; ok: false } | { html: string; ok: true };

/** Module-local redeclaration of the worker's own global, so the scope is
 *  typed by what it is rather than cast away from the DOM's `Window`. */
declare const self: DedicatedWorkerGlobalScope;

self.addEventListener('message', (event: MessageEvent<{ arrayBuffer: ArrayBuffer }>) => {
  void mammoth
    .convertToHtml(
      { arrayBuffer: event.data.arrayBuffer },
      { convertImage: mammoth.images.dataUri },
    )
    .then((result) => {
      self.postMessage(
        {
          html: sanitizeDocxHtml(result.value),
          ok: true,
        } satisfies DocxWorkerResponse,
        [],
      );
    })
    .catch((cause: unknown) => {
      self.postMessage(
        {
          detail: cause instanceof Error ? cause.message : String(cause),
          ok: false,
        } satisfies DocxWorkerResponse,
        [],
      );
    });
});
