import { describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentTabsRuntime, type DocumentSourceApi } from '@/features/documents/public';
import { createWorkspaceRuntime } from '@/features/workspace/public';

import { retireDocuments } from './retire-documents';

function createWorkspace() {
  return createWorkspaceRuntime({
    folder: { name: 'Notes', path: '/library/notes' },
    generation: 1,
    queries: { cancel: vi.fn(async () => undefined), remove: vi.fn() },
  });
}

function createDocuments(
  api: DocumentSourceApi = { load: vi.fn(), overwrite: vi.fn(), save: vi.fn() },
) {
  let next = 0;
  return createDocumentTabsRuntime({
    api,
    createId: () => `tab-${++next}`,
    createQueries: () => ({
      cancel: vi.fn(async () => undefined),
      remove: vi.fn(),
      replaceSource: vi.fn(),
    }),
    folderPath: '/library/notes',
    generation: 1,
    restored: {
      activeTabId: 'tab-a',
      tabs: [
        { id: 'tab-a', source: { folderPath: '/library/notes', path: 'drafts/plan.md' } },
        { id: 'tab-b', source: { folderPath: '/library/notes', path: 'drafts/2026/notes.md' } },
        { id: 'tab-c', source: { folderPath: '/library/notes', path: 'drafts-old/keep.md' } },
      ],
    },
  });
}

describe('retire documents workflow', () => {
  it('closes only the documents under the entry and answers their sources', async () => {
    const workspace = createWorkspace();
    const documents = createDocuments();

    const retired = await retireDocuments(workspace, documents, {
      kind: 'folder',
      path: 'drafts',
    });

    expect(retired).toEqual([
      { folderPath: '/library/notes', path: 'drafts/plan.md' },
      { folderPath: '/library/notes', path: 'drafts/2026/notes.md' },
    ]);
    expect(documents.store.getState().tabs.map((tab) => tab.source.path)).toEqual([
      'drafts-old/keep.md',
    ]);
  });

  it('answers nothing to reopen when no document is under the entry', async () => {
    const workspace = createWorkspace();
    const documents = createDocuments();

    expect(await retireDocuments(workspace, documents, { kind: 'file', path: 'other.md' })).toEqual(
      [],
    );
    expect(documents.store.getState().tabs).toHaveLength(3);
  });

  it('stops at the first document that cannot be closed', async () => {
    const workspace = createWorkspace();
    const documents = createDocuments();
    const close = vi.spyOn(documents, 'close').mockResolvedValueOnce(false);

    expect(
      await retireDocuments(workspace, documents, { kind: 'folder', path: 'drafts' }),
    ).toBeNull();
    expect(close).toHaveBeenCalledOnce();
    expect(documents.store.getState().tabs).toHaveLength(3);
  });

  it('leaves a document collection from another folder generation alone', async () => {
    const workspace = createWorkspace();
    const documents = createDocuments();
    workspace.dispose();
    const later = createWorkspaceRuntime({
      folder: { name: 'Notes', path: '/library/notes' },
      generation: 2,
      queries: { cancel: vi.fn(async () => undefined), remove: vi.fn() },
    });

    expect(await retireDocuments(later, documents, { kind: 'folder', path: 'drafts' })).toEqual([]);
    expect(documents.store.getState().tabs).toHaveLength(3);
  });
});
