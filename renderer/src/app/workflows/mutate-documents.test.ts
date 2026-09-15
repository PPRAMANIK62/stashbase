import { describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentTabsRuntime, type DocumentAdapters } from '@/features/documents/public';
import { createWorkspaceRuntime } from '@/features/workspace/test-support';

import { mutateDocuments } from './mutate-documents';

function createWorkspace() {
  return createWorkspaceRuntime({
    folder: { name: 'Notes', path: '/project/notes' },
    generation: 1,
    queries: { cancel: vi.fn(async () => undefined), remove: vi.fn() },
  });
}

function createDocuments(
  api: DocumentAdapters['source'] = { load: vi.fn(), overwrite: vi.fn(), save: vi.fn() },
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
    folderPath: '/project/notes',
    generation: 1,
    restored: {
      activeTabId: 'tab-a',
      tabs: [
        { id: 'tab-a', source: { folderPath: '/project/notes', path: 'drafts/plan.md' } },
        { id: 'tab-b', source: { folderPath: '/project/notes', path: 'drafts/2026/notes.md' } },
        { id: 'tab-c', source: { folderPath: '/project/notes', path: 'drafts-old/keep.md' } },
      ],
    },
  });
}

function document(documents: ReturnType<typeof createDocuments>, id: string) {
  const opened = documents.getDocument(id);
  if (!opened) throw new Error('Missing document.');
  return opened;
}

describe('document file mutations', () => {
  const entry = { kind: 'folder', path: 'drafts' } as const;

  it('retains tab identities, order, selection and draft state after a confirmed rename', async () => {
    const workspace = createWorkspace();
    const documents = createDocuments();
    const first = document(documents, 'tab-a');
    const before = first.capture();
    first.setMarkdownMode('reading');
    expect(await mutateDocuments(workspace, documents, entry, async () => 'renamed')).toBe(true);
    expect(documents.getDocument('tab-a')).toBe(first);
    expect(first.store.getState().markdownMode).toBe('reading');
    expect(first.accept(before, vi.fn())).toBe(false);
    expect(documents.store.getState().activeTabId).toBe('tab-a');
    expect(documents.openSources().map((source) => source.path)).toEqual([
      'renamed/plan.md',
      'renamed/2026/notes.md',
      'drafts-old/keep.md',
    ]);
    documents.dispose();
  });

  it('keeps all tabs when a later save fails and never starts the mutation', async () => {
    const documents = createDocuments();
    vi.spyOn(document(documents, 'tab-a'), 'save').mockResolvedValue(true);
    vi.spyOn(document(documents, 'tab-b'), 'save').mockResolvedValue(false);
    const operation = vi.fn(async () => null);
    expect(await mutateDocuments(createWorkspace(), documents, entry, operation)).toBe(false);
    expect(operation).not.toHaveBeenCalled();
    expect(documents.openSources()).toHaveLength(3);
    expect(documents.store.getState().activeTabId).toBe('tab-b');
    expect(documents.getDocument('tab-a')?.store.getState().mutationPending).toBe(false);
    documents.dispose();
  });

  it('retains tabs on filesystem failure and releases only after confirmed deletion', async () => {
    const documents = createDocuments();
    const workspace = createWorkspace();
    const first = documents.getDocument('tab-a');
    await expect(
      mutateDocuments(workspace, documents, entry, async () => {
        throw Error('denied');
      }),
    ).rejects.toThrow('denied');
    expect(documents.getDocument('tab-a')).toBe(first);
    expect(documents.openSources()).toHaveLength(3);
    expect(await mutateDocuments(workspace, documents, entry, async () => null)).toBe(true);
    expect(documents.openSources().map((source) => source.path)).toEqual(['drafts-old/keep.md']);
    expect(first?.signal.aborted).toBe(true);
    documents.dispose();
  });

  it('refuses a mutation if the workspace retires during its save barrier', async () => {
    const documents = createDocuments();
    const workspace = createWorkspace();
    vi.spyOn(document(documents, 'tab-a'), 'save').mockImplementationOnce(async () => {
      workspace.retireOperations();
      return true;
    });
    const operation = vi.fn(async () => null);
    await expect(mutateDocuments(workspace, documents, entry, operation)).rejects.toThrow(
      'Project changed',
    );
    expect(operation).not.toHaveBeenCalled();
    expect(documents.openSources()).toHaveLength(3);
    documents.dispose();
  });
});
