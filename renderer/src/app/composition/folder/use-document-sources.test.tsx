import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentTabsRuntime, type DocumentTabsRuntime } from '@/features/documents/public';
import type { WorkspaceRuntime } from '@/features/workspace/public';
import { createWorkspaceRuntime } from '@/features/workspace/test-support';
import { documentTabsRuntimeOptions, sourceApi } from '@/test/fakes/documents';
import {
  RESEARCH_FOLDER,
  workspaceAdapters,
  workspaceRuntimeOptions,
} from '@/test/fakes/workspace';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { useDocumentSources } from './use-document-sources';

afterEach(cleanup);

const folderPath = RESEARCH_FOLDER.path;
const notes = { folderPath, path: 'notes.md' };

function documentsRuntime(): DocumentTabsRuntime {
  return createDocumentTabsRuntime(
    documentTabsRuntimeOptions({ api: sourceApi(), folderPath, generation: 1 }),
  );
}

function mount(workspace: WorkspaceRuntime | null, documents: DocumentTabsRuntime | null) {
  return renderHook(() => useDocumentSources(workspaceAdapters(), workspace, documents), {
    wrapper: queryWrapper(createTestQueryClient()),
  });
}

describe('useDocumentSources', () => {
  it('opens nothing while a runtime is missing', async () => {
    const documents = documentsRuntime();
    const open = vi.spyOn(documents, 'open');
    const { result } = mount(null, documents);

    result.current.open(notes);
    result.current.navigate({ source: notes });

    expect(open).not.toHaveBeenCalled();
    documents.dispose();
  });

  it('opens a source in the workspace it belongs to', async () => {
    const workspace = createWorkspaceRuntime(workspaceRuntimeOptions({ folder: RESEARCH_FOLDER }));
    const documents = documentsRuntime();
    const { result } = mount(workspace, documents);

    result.current.open(notes);

    await vi.waitFor(() => expect(documents.openSources()).toHaveLength(1));
    documents.dispose();
    workspace.dispose();
  });

  it('carries a link anchor through to the opened document', async () => {
    const workspace = createWorkspaceRuntime(workspaceRuntimeOptions({ folder: RESEARCH_FOLDER }));
    const documents = documentsRuntime();
    const open = vi.spyOn(documents, 'open');
    const { result } = mount(workspace, documents);

    result.current.navigate({ anchor: 'results', source: notes });

    expect(open).toHaveBeenCalledWith(notes, { anchor: 'results' });
    documents.dispose();
    workspace.dispose();
  });

  it('opens a search hit on the match it was found at', async () => {
    const workspace = createWorkspaceRuntime(workspaceRuntimeOptions({ folder: RESEARCH_FOLDER }));
    const documents = documentsRuntime();
    const open = vi.spyOn(documents, 'open');
    const { result } = mount(workspace, documents);
    const target = {
      caseSensitive: false,
      line: 1,
      occurrenceIndex: 1,
      query: 'answer',
      wholeWord: false,
    };

    await expect(
      result.current.navigateToMatch({ source: notes, target, type: 'open-search-source' }),
    ).resolves.toBe(true);

    expect(open).toHaveBeenCalledWith(notes, { search: target });
    expect(documents.activeSource()).toEqual(notes);
    documents.dispose();
    workspace.dispose();
  });

  it('refuses a search hit while no workspace is mounted', async () => {
    const { result } = mount(null, null);

    await expect(
      result.current.navigateToMatch({
        source: notes,
        type: 'open-search-source',
        target: {
          caseSensitive: false,
          line: 1,
          occurrenceIndex: 0,
          query: 'answer',
          wholeWord: false,
        },
      }),
    ).resolves.toBe(false);
  });

  it('answers an empty retirement while no runtime is bound', async () => {
    const { result } = mount(null, null);

    await expect(result.current.retire({ kind: 'file', path: 'notes.md' })).resolves.toEqual([]);
  });

  it('lets a folder change through when nothing is open', async () => {
    const { result } = mount(null, null);

    await expect(result.current.saveOpenFolder()).resolves.toBe(true);
  });

  it('flushes the open folder before it is left', async () => {
    const workspace = createWorkspaceRuntime(workspaceRuntimeOptions({ folder: RESEARCH_FOLDER }));
    const documents = documentsRuntime();
    const flush = vi.spyOn(documents, 'flush');
    const { result } = mount(workspace, documents);

    await expect(result.current.saveOpenFolder()).resolves.toBe(true);

    expect(flush).toHaveBeenCalledTimes(1);
    documents.dispose();
    workspace.dispose();
  });
});
