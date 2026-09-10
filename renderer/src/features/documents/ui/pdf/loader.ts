import { getDocument, PDFWorker } from 'pdfjs-dist';

import './pdfjs-compat';
import type { PdfLoadTask } from './use-pdf-document';
import PdfWorkerPort from './worker?worker';

export function openPdfDocument(url: string): PdfLoadTask {
  const port = new PdfWorkerPort();
  const worker = PDFWorker.create({ port });
  const assetBase = new URL('/pdfjs-assets/', url).href;
  const task = getDocument({
    cMapPacked: true,
    cMapUrl: `${assetBase}cmaps/`,
    disableFontFace: true,
    standardFontDataUrl: `${assetBase}standard_fonts/`,
    url,
    useWorkerFetch: true,
    wasmUrl: `${assetBase}wasm/`,
    worker,
  });
  let destroyed = false;
  return {
    async destroy() {
      if (destroyed) return;
      destroyed = true;
      // swallowed: the load was abandoned, so a failed teardown has no reader.
      await task.destroy().catch(() => undefined);
      worker.destroy();
      port.terminate();
    },
    promise: task.promise,
  };
}
