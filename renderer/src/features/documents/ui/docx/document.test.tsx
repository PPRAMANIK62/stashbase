import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentRuntime } from '@/features/documents/application/document-runtime';
import { createDocumentNavigationRuntime } from '@/features/documents/application/navigation-runtime';
import type { DocxPreviewApi } from '@/features/documents/application/ports';

import { DocxDocument } from './document';

const resource = {
  fallbackUrl: 'data:text/html,prepared',
  kind: 'docx' as const,
  url: 'data:application/octet-stream,docx',
  version: 'one',
};

function renderDocument(api: DocxPreviewApi) {
  const runtime = createDocumentRuntime({
    activeFolderPath: '/library',
    generation: 1,
    id: 'tab-1',
    queries: {
      cancel: vi.fn(async () => undefined),
      remove: vi.fn(),
      replaceSource: vi.fn(),
    },
    source: { folderPath: '/library', path: 'documents/report.docx' },
  });
  const navigation = createDocumentNavigationRuntime('tab-1');
  const onNavigate = vi.fn();
  const onOpenExternal = vi.fn(async () => true);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DocxDocument
        active
        api={api}
        name="report.docx"
        navigation={navigation}
        onNavigate={onNavigate}
        onOpenExternal={onOpenExternal}
        resource={resource}
        runtime={runtime}
      />
    </QueryClientProvider>,
  );
  return { client, navigation, onNavigate, onOpenExternal, runtime };
}

afterEach(() => cleanup());

describe('DOCX document', () => {
  it('renders sanitized worker output as a paper surface with Find, outline, and links', async () => {
    const api: DocxPreviewApi = {
      load: vi.fn(async () => ({
        html: '<h1>Quarterly report</h1><p>Local results</p><a href="notes.md">Notes</a>',
      })),
    };
    const rendered = renderDocument(api);
    const document = await screen.findByRole('article', { name: 'report.docx document content' });

    expect(document.className).toContain('max-w-[56rem]');
    expect(document.parentElement?.className).toContain('bg-surface-2');
    await waitFor(() => expect(rendered.navigation.store.getState().find.available).toBe(true));
    await waitFor(() =>
      expect(rendered.navigation.store.getState().outline.headings).toEqual([
        expect.objectContaining({ id: 'quarterly-report', level: 1, text: 'Quarterly report' }),
      ]),
    );

    await userEvent.setup().click(screen.getByRole('link', { name: 'Notes' }));
    expect(rendered.onNavigate).toHaveBeenCalledWith({
      source: { folderPath: '/library', path: 'documents/notes.md' },
    });
    rendered.runtime.dispose();
    rendered.navigation.dispose();
    rendered.client.clear();
  });

  it('keeps source identity visible and uses the prepared sandbox after direct failure', async () => {
    const api: DocxPreviewApi = { load: vi.fn(async () => Promise.reject(new Error('broken'))) };
    const rendered = renderDocument(api);

    expect(await screen.findByText(/Direct preview unavailable/u)).not.toBeNull();
    const frame = screen.getByTitle('report.docx HTML preview');
    expect(frame.getAttribute('src')).toBe(resource.fallbackUrl);
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(api.load).toHaveBeenCalledTimes(2);
    fireEvent.load(frame);
    rendered.runtime.dispose();
    rendered.navigation.dispose();
    rendered.client.clear();
  });
});
