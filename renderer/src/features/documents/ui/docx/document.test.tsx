import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentRuntime } from '@/features/documents/application/document-runtime';
import { createDocumentNavigationRuntime } from '@/features/documents/application/navigation-runtime';
import type { DocxPreviewPort } from '@/features/documents/application/ports';
import { documentQueryScope, docxPreviewApi } from '@/test/fakes/documents';
import { createTestQueryClient, withQueryClient } from '@/test/query';

import { DocxDocument } from './document';

const resource = {
  fallbackUrl: 'data:text/html,prepared',
  kind: 'docx' as const,
  url: 'data:application/octet-stream,docx',
  version: 'one',
};

function renderDocument(api: DocxPreviewPort) {
  const runtime = createDocumentRuntime({
    activeFolderPath: '/library',
    generation: 1,
    id: 'tab-1',
    queries: documentQueryScope(),
    source: { folderPath: '/library', path: 'documents/report.docx' },
  });
  const navigation = createDocumentNavigationRuntime('tab-1');
  const onNavigate = vi.fn();
  const onOpenExternal = vi.fn(async () => true);
  const client = createTestQueryClient();
  withQueryClient(
    <DocxDocument
      active
      api={api}
      name="report.docx"
      navigation={navigation}
      onNavigate={onNavigate}
      onOpenExternal={onOpenExternal}
      resource={resource}
      runtime={runtime}
    />,
    client,
  );
  return { client, navigation, onNavigate, onOpenExternal, runtime };
}

afterEach(() => cleanup());

describe('DOCX document', () => {
  it('renders sanitized worker output with Find, outline, and links', async () => {
    const api = docxPreviewApi({
      load: vi.fn(async () => ({
        html: '<h1>Quarterly report</h1><p>Local results</p><a href="notes.md">Notes</a>',
      })),
    });
    const rendered = renderDocument(api);
    const document = await screen.findByRole('article', { name: 'report.docx document content' });

    expect(document.textContent).toContain('Local results');
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
    const api = docxPreviewApi({
      load: vi.fn<DocxPreviewPort['load']>(async () => Promise.reject(new Error('broken'))),
    });
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
