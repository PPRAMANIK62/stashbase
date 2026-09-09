import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentRuntime } from '@/features/documents/application/document-runtime';
import { createDocumentNavigationRuntime } from '@/features/documents/application/navigation-runtime';
import type { DocumentAsset } from '@/features/documents/application/ports';
import { documentQueryScope } from '@/test/fakes/documents';

const loaderHarness = vi.hoisted(() => ({
  /** Rejects the next open, so the failure panel can be asserted. */
  failure: null as string | null,
  loads: 0,
  numPages: 3,
}));

vi.mock('./loader', () => ({
  openPdfDocument: () => {
    loaderHarness.loads += 1;
    const document = {
      destroy: async () => undefined,
      getPage: async () => ({ getViewport: () => ({ height: 792, width: 612 }) }),
      numPages: loaderHarness.numPages,
    };
    return {
      destroy: async () => undefined,
      promise: loaderHarness.failure
        ? Promise.reject(new Error(loaderHarness.failure))
        : Promise.resolve(document),
    };
  },
}));

// The page canvas needs a real pdf.js render pipeline; the viewer's own
// behaviour is the toolbar, the page marker, and the remembered page.
vi.mock('./page', () => ({
  PdfPage: ({ pageNumber }: { pageNumber: number }) => (
    <div aria-label={`Page ${pageNumber}`} data-page={pageNumber} role="group" />
  ),
}));

const { PdfDocument } = await import('./document');

const runtimes: ReturnType<typeof createDocumentRuntime>[] = [];
const navigations: ReturnType<typeof createDocumentNavigationRuntime>[] = [];

afterEach(() => {
  cleanup();
  loaderHarness.failure = null;
  loaderHarness.loads = 0;
  loaderHarness.numPages = 3;
  for (const runtime of runtimes.splice(0)) runtime.dispose();
  for (const navigation of navigations.splice(0)) navigation.dispose();
});

const resource: DocumentAsset = { kind: 'source', url: 'blob:paper', version: 'v1' };

function renderPdf(pdfPage = 1) {
  const source = { folderPath: '/library/notes', path: 'paper.pdf' };
  const runtime = createDocumentRuntime({
    activeFolderPath: '/library/notes',
    generation: 1,
    id: 'tab-1',
    queries: documentQueryScope(),
    source,
  });
  runtimes.push(runtime);
  runtime.setPdfPage(pdfPage);
  const navigation = createDocumentNavigationRuntime('tab-1');
  navigations.push(navigation);
  render(
    <PdfDocument name="paper.pdf" navigation={navigation} resource={resource} runtime={runtime} />,
  );
  return { navigation, runtime };
}

describe('PDF document viewer', () => {
  it('names the file while the document is still opening', () => {
    renderPdf();
    expect(screen.getByText('Loading paper.pdf')).not.toBeNull();
  });

  it('reports why a PDF could not be opened and reopens it on retry', async () => {
    loaderHarness.failure = 'The PDF is encrypted.';
    renderPdf();

    // PDF.js says why in developer terms; the reader gets one sentence.
    expect((await screen.findByRole('alert')).textContent).toBe('The PDF could not be opened.');
    expect(screen.getByText('Could not open paper.pdf')).not.toBeNull();

    loaderHarness.failure = null;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('region', { name: 'paper.pdf pages' });
    expect(loaderHarness.loads).toBe(2);
  });

  it('renders one page per document page with the total beside the current one', async () => {
    await renderPdf().runtime;
    await screen.findByRole('region', { name: 'paper.pdf pages' });

    expect(screen.getAllByRole('group', { name: /^Page \d+$/u })).toHaveLength(3);
    expect(screen.getByLabelText('of 3 pages').textContent).toBe('/ 3');
    expect(screen.getByRole('group', { name: 'Zoom controls' })).not.toBeNull();
  });

  it('restores the page the document runtime remembers', async () => {
    const { runtime } = renderPdf(2);
    await screen.findByRole('region', { name: 'paper.pdf pages' });

    await waitFor(() => expect(runtime.store.getState().pdfPage).toBe(2));
  });

  it('claims Find for its tab once the document is open', async () => {
    const { navigation } = renderPdf();
    await screen.findByRole('region', { name: 'paper.pdf pages' });

    await waitFor(() => expect(navigation.store.getState().find.available).toBe(true));
  });
});
