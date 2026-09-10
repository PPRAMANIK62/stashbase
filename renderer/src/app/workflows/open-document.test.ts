import { describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentTabsRuntime } from '@/features/documents/public';
import { createWorkspaceRuntime } from '@/features/workspace/test-support';

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
    api: { load: vi.fn(), overwrite: vi.fn(), save: vi.fn() },
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
  it('opens through the matching live workspace and document scopes', async () => {
    const workspace = createWorkspace();
    const documents = createDocuments();

    const opened = await openDocument(workspace, documents, {
      folderPath: '/library/notes',
      path: 'plan.md',
    });

    expect(opened?.scope.source.path).toBe('plan.md');
    expect(documents.activeSource()).toEqual({ folderPath: '/library/notes', path: 'plan.md' });
  });

  it('rejects an open after either captured scope is disposed', async () => {
    const workspace = createWorkspace();
    const documents = createDocuments();
    workspace.dispose();

    expect(
      await openDocument(workspace, documents, {
        folderPath: '/library/notes',
        path: 'late.md',
      }),
    ).toBeNull();
    expect(documents.openSources()).toEqual([]);
  });

  it('rejects a live document collection belonging to another folder generation', async () => {
    const workspace = createWorkspace();
    const documents = createDocumentTabsRuntime({
      api: { load: vi.fn(), overwrite: vi.fn(), save: vi.fn() },
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
      await openDocument(workspace, documents, {
        folderPath: '/library/notes',
        path: 'late.md',
      }),
    ).toBeNull();
    expect(documents.openSources()).toEqual([]);
  });
});
