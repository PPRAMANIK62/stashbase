import { describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentTabsRuntime } from '@/features/documents/public';
import { createWorkspaceRuntime } from '@/features/workspace/public';

import { openDocument } from './open-document';

function createWorkspace() {
  return createWorkspaceRuntime({
    folder: { name: 'Notes', path: '/library/notes' },
    generation: 1,
    queries: { cancel: vi.fn(async () => undefined), remove: vi.fn() },
  });
}

function createDocuments() {
  return createDocumentTabsRuntime({
    createId: () => 'tab-1',
    createQueries: () => ({
      cancel: vi.fn(async () => undefined),
      remove: vi.fn(),
      replaceSource: vi.fn(),
    }),
    folderPath: '/library/notes',
    generation: 1,
  });
}

describe('open document workflow', () => {
  it('opens through the matching live workspace and document scopes', () => {
    const workspace = createWorkspace();
    const documents = createDocuments();

    const opened = openDocument(workspace, documents, {
      folderPath: '/library/notes',
      path: 'plan.md',
    });

    expect(opened?.scope.source.path).toBe('plan.md');
    expect(documents.store.getState().activeTabId).toBe('tab-1');
  });

  it('rejects an open after either captured scope is disposed', () => {
    const workspace = createWorkspace();
    const documents = createDocuments();
    workspace.dispose();

    expect(
      openDocument(workspace, documents, {
        folderPath: '/library/notes',
        path: 'late.md',
      }),
    ).toBeNull();
    expect(documents.store.getState().tabs).toEqual([]);
  });

  it('rejects a live document collection belonging to another folder generation', () => {
    const workspace = createWorkspace();
    const documents = createDocumentTabsRuntime({
      createId: () => 'tab-1',
      createQueries: () => ({
        cancel: vi.fn(async () => undefined),
        remove: vi.fn(),
        replaceSource: vi.fn(),
      }),
      folderPath: '/library/notes',
      generation: 2,
    });

    expect(
      openDocument(workspace, documents, {
        folderPath: '/library/notes',
        path: 'late.md',
      }),
    ).toBeNull();
    expect(documents.store.getState().tabs).toEqual([]);
  });
});
