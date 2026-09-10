import { EditorView } from '@codemirror/view';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { DocumentSaveError, type DocumentSourcePort } from '@/features/documents/application/ports';
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

/** A port call that never settles, for the viewers a text tab never opens. */
function pending(): () => Promise<never> {
  return () => new Promise<never>(() => undefined);
}

function renderSource(api: DocumentSourcePort, source: { folderPath: string; path: string }) {
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
      onReveal={vi.fn(async () => undefined)}
      revealLabel="Show in file manager"
      runtime={runtime}
      sourceApi={api}
    />,
    queryClient,
  );
  return { runtime };
}

function codeEditor(label: string): EditorView {
  const content = screen.getByLabelText(label);
  const editor = content.closest<HTMLElement>('.cm-editor');
  const view = editor ? EditorView.findFromDOM(editor) : null;
  if (!view) throw new Error(`Could not find CodeMirror editor for ${label}.`);
  return view;
}

describe('document save conflict', () => {
  it('compares both conflict versions and turns merge into an editable draft', async () => {
    const api = sourceApi({
      load: vi
        .fn<DocumentSourcePort['load']>()
        .mockResolvedValueOnce(textSource({ content: 'shared\nbefore', format: 'txt' }))
        .mockResolvedValueOnce(
          textSource({ content: 'shared\ndisk change', format: 'txt', version: 'v2' }),
        ),
      save: vi
        .fn<DocumentSourcePort['save']>()
        .mockRejectedValueOnce(
          new DocumentSaveError('conflict', 'changed', { currentVersion: 'v2' }),
        )
        .mockResolvedValue(textSource({ content: 'merged', format: 'txt', version: 'v3' })),
    });
    const { runtime } = renderSource(api, { folderPath: '/library/notes', path: 'plan.txt' });
    await screen.findByLabelText('plan.txt source');
    const editor = codeEditor('plan.txt source');
    editor.dispatch({
      changes: { from: 0, insert: 'shared\neditor change', to: editor.state.doc.length },
    });

    await act(async () => {
      await runtime.getDocument('tab-1')?.save(api);
    });

    expect(await screen.findByRole('heading', { name: 'plan.txt changed on disk' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Reload' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Merge' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Overwrite' })).not.toBeNull();
    expect(screen.getByText('disk change')).not.toBeNull();
    expect(screen.getByText('editor change')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    await screen.findByLabelText('plan.txt source');
    const merged = codeEditor('plan.txt source').state.doc.toString();
    expect(merged).toContain('<<<<<<< Editor Version\neditor change');
    expect(merged).toContain('=======\ndisk change\n>>>>>>> Disk Version');
    expect(runtime.getDocument('tab-1')?.store.getState().editor).toMatchObject({
      save: { kind: 'dirty' },
      version: 'v2',
    });
  });
});
