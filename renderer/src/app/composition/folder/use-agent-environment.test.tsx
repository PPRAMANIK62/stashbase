import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createDocumentTabsRuntime, type DocumentTabsRuntime } from '@/features/documents/public';
import type { FolderIndexStatus } from '@/features/preparation/public';
import { documentTabsRuntimeOptions } from '@/test/fakes/documents';
import { folderIndexStatus } from '@/test/fakes/preparation';
import { listing, listingFile, listingFolder, RESEARCH_FOLDER } from '@/test/fakes/workspace';

import { useAgentEnvironment } from './use-agent-environment';

afterEach(cleanup);

const folderPath = RESEARCH_FOLDER.path;

const folderListing = listing(
  [
    listingFile({ format: 'md', path: 'notes.md' }),
    listingFile({ format: 'pdf', path: 'papers/study.pdf' }),
  ],
  [listingFolder({ path: 'papers' }), listingFolder({ kind: 'excluded', path: '.stashbase' })],
);

function pendingStatus(): FolderIndexStatus {
  return folderIndexStatus({
    conversionVersions: { 'papers/study.pdf': 3 },
    pendingConversions: ['papers/study.pdf'],
  });
}

function mount(
  status: FolderIndexStatus | null = null,
  documents: DocumentTabsRuntime | null = null,
) {
  return renderHook(() =>
    useAgentEnvironment(folderListing, status, documents, folderPath, folderPath),
  );
}

describe('useAgentEnvironment', () => {
  it("publishes nothing until the folder's listing has arrived", () => {
    const { result } = renderHook(() =>
      useAgentEnvironment(undefined, null, null, folderPath, folderPath),
    );

    expect(result.current).toEqual({
      environment: null,
      outline: null,
      scope: { kind: 'folder', path: folderPath },
    });
  });

  it("names the folder's top level for the starter prompts", () => {
    const { result } = mount();

    // The outline is the folder as the reader sees it in the tree, so a
    // derived folder is still named; only bindable context filters it out.
    expect(result.current.outline).toEqual({
      files: ['notes.md'],
      folders: ['papers', '.stashbase'],
    });
  });

  it('keeps an outline but no environment while no folder is open', () => {
    const { result } = renderHook(() => useAgentEnvironment(folderListing, null, null, null, null));

    expect(result.current.outline).not.toBeNull();
    expect(result.current.environment).toBeNull();
    // Nothing is selected, so a new chat is scoped to the whole library.
    expect(result.current.scope).toEqual({ kind: 'library' });
  });

  it('hides derived folders from what the Agent can see', () => {
    const { result } = mount();

    expect(result.current.environment?.listing.folders).toEqual(['papers']);
    expect(result.current.environment?.listing.files.map((file) => file.path)).toEqual([
      'notes.md',
      'papers/study.pdf',
    ]);
  });

  it('reports only the sources that are not already current', () => {
    const { result } = mount(pendingStatus());

    expect(result.current.environment?.readiness).toEqual({ 'papers/study.pdf': 'pending' });
    expect(result.current.environment?.versions).toEqual({ 'papers/study.pdf': 3 });
  });

  it('leads with the documents open beside the chat', async () => {
    const documents = createDocumentTabsRuntime(
      documentTabsRuntimeOptions({
        folderPath,
        restored: {
          activeTabId: 'tab-1',
          tabs: [{ id: 'tab-1', source: { folderPath, path: 'notes.md' } }],
        },
      }),
    );
    const { result } = mount(null, documents);
    expect(result.current.environment?.openPaths).toEqual(['notes.md']);

    await act(() => documents.close('tab-1'));

    expect(result.current.environment?.openPaths).toEqual([]);
    documents.dispose();
  });

  it('hands back the same environment while nothing it reads has changed', () => {
    const { rerender, result } = mount();
    const first = result.current.environment;

    rerender();

    expect(result.current.environment).toBe(first);
  });
});
