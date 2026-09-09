import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { preparationQueryKeys } from '@/features/preparation/test-support';
import { workspaceQueryKeys } from '@/features/workspace/test-support';
import { listing, RESEARCH_FOLDER } from '@/test/fakes/workspace';
import { createRetainingTestQueryClient, queryWrapper } from '@/test/query';

import { useFolderRefresh, type FolderRefreshOptions } from './use-folder-refresh';

afterEach(cleanup);

const OTHER_FOLDER = '/Library/Archive';

/** The hook over a client whose files and status entries are already seeded,
 *  so an invalidation is visible as a stale entry. */
function mount(options: Partial<FolderRefreshOptions> = {}) {
  const client = createRetainingTestQueryClient();
  client.setQueryData(workspaceQueryKeys.files(RESEARCH_FOLDER.path), listing(['notes.md']));
  client.setQueryData(preparationQueryKeys.folderStatus(RESEARCH_FOLDER.path), null);
  const syncFolder = vi.fn(async () => undefined);
  const reprocessSource = vi.fn(async () => undefined);
  const view = renderHook((props: FolderRefreshOptions) => useFolderRefresh(props), {
    initialProps: {
      folderPath: RESEARCH_FOLDER.path,
      reprocessSource,
      syncFolder,
      treeVersion: undefined,
      ...options,
    },
    wrapper: queryWrapper(client),
  });
  const isStale = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated === true;
  return { ...view, client, isStale, reprocessSource, syncFolder };
}

describe('useFolderRefresh', () => {
  it('re-reads the folder on demand', () => {
    const { isStale, result } = mount();

    act(() => result.current.refresh());

    expect(isStale(workspaceQueryKeys.files(RESEARCH_FOLDER.path))).toBe(true);
    expect(isStale(preparationQueryKeys.folderStatus(RESEARCH_FOLDER.path))).toBe(true);
  });

  it('does nothing on demand while no folder is open', () => {
    const { isStale, result } = mount({ folderPath: null });

    act(() => result.current.refresh());

    expect(isStale(workspaceQueryKeys.files(RESEARCH_FOLDER.path))).toBe(false);
  });

  it('ignores the first tree revision it sees for a folder', () => {
    const { isStale } = mount({ treeVersion: 4 });

    expect(isStale(workspaceQueryKeys.files(RESEARCH_FOLDER.path))).toBe(false);
  });

  it('re-reads the listing once the tree revision moves', () => {
    const { isStale, rerender } = mount({ treeVersion: 4 });

    rerender({
      folderPath: RESEARCH_FOLDER.path,
      reprocessSource: vi.fn(async () => undefined),
      syncFolder: vi.fn(async () => undefined),
      treeVersion: 5,
    });

    expect(isStale(workspaceQueryKeys.files(RESEARCH_FOLDER.path))).toBe(true);
  });

  it('does not re-read on the first revision seen after a folder switch', () => {
    const { isStale, rerender, reprocessSource, syncFolder } = mount({
      folderPath: OTHER_FOLDER,
      treeVersion: 9,
    });

    rerender({ folderPath: RESEARCH_FOLDER.path, reprocessSource, syncFolder, treeVersion: 4 });

    expect(isStale(workspaceQueryKeys.files(RESEARCH_FOLDER.path))).toBe(false);
  });

  it('reconciles the folder an Agent wrote into', async () => {
    const { isStale, result, syncFolder } = mount();

    act(() =>
      result.current.onAgentFilesChanged({
        paths: ['notes.md'],
        scope: { kind: 'folder', path: RESEARCH_FOLDER.path },
        sources: [{ folderPath: RESEARCH_FOLDER.path, path: 'notes.md' }],
      }),
    );

    expect(syncFolder).toHaveBeenCalledExactlyOnceWith(RESEARCH_FOLDER.path);
    await waitFor(() =>
      expect(isStale(preparationQueryKeys.folderStatus(RESEARCH_FOLDER.path))).toBe(true),
    );
  });

  it('re-reads the folder once a reprocess has settled', async () => {
    const { isStale, reprocessSource, result } = mount();
    const source = { folderPath: RESEARCH_FOLDER.path, path: 'notes.md' };

    act(() => result.current.reprocess(source));

    expect(reprocessSource).toHaveBeenCalledExactlyOnceWith(source);
    await waitFor(() =>
      expect(isStale(preparationQueryKeys.folderStatus(RESEARCH_FOLDER.path))).toBe(true),
    );
  });

  it('leaves a library-scoped change alone', () => {
    const { result, syncFolder } = mount();

    act(() =>
      result.current.onAgentFilesChanged({ paths: [], scope: { kind: 'library' }, sources: [] }),
    );

    expect(syncFolder).not.toHaveBeenCalled();
  });
});
