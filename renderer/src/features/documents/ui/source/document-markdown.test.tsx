import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { DocumentSourcePort } from '@/features/documents/application/ports';
import { createDocumentQueryScope } from '@/features/documents/application/queries';
import { createDocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';
import { DocumentWorkspace } from '@/features/documents/ui/workspace/workspace';
import {
  assetApi,
  docxPreviewApi,
  genericPreviewApi,
  mediaApi,
  sourceApi,
  textSource,
} from '@/test/fakes/documents';
import { createTestQueryClient, withQueryClient } from '@/test/query';

const runtimes: ReturnType<typeof createDocumentTabsRuntime>[] = [];

afterEach(() => {
  cleanup();
  for (const runtime of runtimes.splice(0)) runtime.dispose();
});

/** A port call that never settles, for the viewers a Markdown tab never opens. */
function pending(): () => Promise<never> {
  return () => new Promise<never>(() => undefined);
}

function renderSource(
  api: DocumentSourcePort,
  source = { folderPath: '/library/notes', path: 'plan.md' },
  options: {
    onNavigate?: Parameters<typeof DocumentWorkspace>[0]['onNavigate'];
    onOpenExternal?: Parameters<typeof DocumentWorkspace>[0]['onOpenExternal'];
  } = {},
) {
  const queryClient = createTestQueryClient();
  const runtime = createDocumentTabsRuntime({
    api,
    createId: () => 'tab-1',
    createQueries: (scope) => createDocumentQueryScope(queryClient, scope),
    folderPath: '/library/notes',
    generation: 1,
    restored: {
      activeTabId: 'tab-1',
      tabs: [{ id: 'tab-1', source }],
    },
  });
  runtimes.push(runtime);
  withQueryClient(
    <DocumentWorkspace
      assetApi={assetApi({ load: vi.fn(pending()) })}
      docxPreviewApi={docxPreviewApi({ load: vi.fn(pending()) })}
      genericPreviewApi={genericPreviewApi({ load: vi.fn(pending()) })}
      mediaApi={mediaApi({ loadTranscript: vi.fn(pending()) })}
      onNavigate={options.onNavigate}
      onOpenExternal={options.onOpenExternal}
      onReveal={vi.fn(async () => undefined)}
      revealLabel="Show in file manager"
      runtime={runtime}
      sourceApi={api}
    />,
    queryClient,
  );
  return { runtime };
}

describe('document Markdown source', () => {
  it('loads versioned Markdown into the Milkdown document surface', async () => {
    const api = sourceApi({
      load: vi.fn(async () =>
        textSource({ content: '# Plan\n\n- Keep the source', version: 'sha256:abc' }),
      ),
    });
    const { runtime } = renderSource(api);

    expect(screen.getByRole('status').textContent).toContain('Loading plan.md');
    const source = await screen.findByRole(
      'document',
      { name: 'plan.md Markdown content' },
      { timeout: 5_000 },
    );

    expect(await screen.findByRole('heading', { name: 'Plan' }, { timeout: 5_000 })).not.toBeNull();
    expect(source.querySelector('[contenteditable="true"]')).not.toBeNull(); // dom-contract: Milkdown/ProseMirror internals
    expect(screen.queryByLabelText('plan.md source')).toBeNull();
    expect(api.load).toHaveBeenCalledWith(
      { folderPath: '/library/notes', path: 'plan.md' },
      expect.any(AbortSignal),
    );
    await waitFor(() =>
      expect(runtime.navigation.store.getState().outline.headings).toEqual([
        expect.objectContaining({ id: 'plan', level: 1, text: 'Plan' }),
      ]),
    );
  });

  it('routes Markdown Find and links through the active document authority', async () => {
    const onNavigate = vi.fn();
    const onOpenExternal = vi.fn(async () => true);
    const api = sourceApi({
      load: vi.fn(async () =>
        textSource({
          content:
            '# Plan\n\nFind this phrase.\n\n[Details](details.md#part)\n\n[Website](https://example.com/docs)',
        }),
      ),
    });
    const { runtime } = renderSource(
      api,
      { folderPath: '/library/notes', path: 'guides/plan.md' },
      { onNavigate, onOpenExternal },
    );
    await screen.findByRole('heading', { name: 'Plan' }, { timeout: 5_000 });

    await waitFor(() => expect(runtime.navigation.store.getState().find.available).toBe(true));
    act(() => expect(runtime.navigation.openFind()).toBe(true));
    const input = await screen.findByRole('textbox', { name: 'Find in document' });
    expect(screen.getByRole('group', { name: 'Find matching options' })).not.toBeNull();
    expect(screen.getByRole('group', { name: 'Find result navigation' })).not.toBeNull();
    fireEvent.change(input, { target: { value: 'Find this phrase' } });
    await waitFor(() => expect(runtime.navigation.store.getState().find.total).toBe(1));

    fireEvent.click(screen.getByRole('link', { name: 'Details' }));
    expect(onNavigate).toHaveBeenCalledWith({
      anchor: 'part',
      source: { folderPath: '/library/notes', path: 'guides/details.md' },
    });
    fireEvent.click(screen.getByRole('link', { name: 'Website' }));
    await waitFor(() => expect(onOpenExternal).toHaveBeenCalledWith('https://example.com/docs'));
  });
});
