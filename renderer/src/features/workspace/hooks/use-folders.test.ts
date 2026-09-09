import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { workspaceQueryKeys } from '@/features/workspace/application/queries';
import type { LibrarySnapshot } from '@/features/workspace/domain/library';
import { folderPicker, libraryApi, librarySnapshot } from '@/test/fakes/workspace';
import { createRetainingTestQueryClient, createTestQueryClient, queryWrapper } from '@/test/query';

import { useFolders } from './use-folders';

afterEach(cleanup);

describe('folder operation generations', () => {
  it('keeps the active folder when the document save barrier fails', async () => {
    const queryClient = createTestQueryClient();
    const openFolder = vi.fn();
    const beforeFolderChange = vi.fn(async () => false);
    const api = libraryApi({ openFolder });
    const folders = renderHook(() => useFolders(api, folderPicker(), beforeFolderChange), {
      wrapper: queryWrapper(queryClient),
    });

    act(() => folders.result.current.select('/library/notes'));

    await waitFor(() => expect(folders.result.current.isPending).toBe(false));
    expect(beforeFolderChange).toHaveBeenCalledOnce();
    expect(openFolder).not.toHaveBeenCalled();
    expect(folders.result.current.failure).toContain('document could not be saved');
  });

  it('keeps the latest selection authoritative when an older request resolves last', async () => {
    const queryClient = createRetainingTestQueryClient();
    const initial = librarySnapshot({
      activeFolder: { name: 'Research', path: '/library/research' },
      homeDirectory: '/library',
      members: [],
    });
    const writing = librarySnapshot({
      ...initial,
      activeFolder: { name: 'Writing', path: '/library/writing' },
    });
    let resolveNotes: ((snapshot: LibrarySnapshot) => void) | undefined;
    let resolveWriting: ((snapshot: LibrarySnapshot) => void) | undefined;
    const openFolder = vi.fn((folderPath: string) => {
      return new Promise<LibrarySnapshot>((resolve) => {
        if (folderPath === '/library/notes') resolveNotes = resolve;
        if (folderPath === '/library/writing') resolveWriting = resolve;
      });
    });
    const api = libraryApi({ openFolder });
    queryClient.setQueryData(workspaceQueryKeys.library, initial);
    const folders = renderHook(() => useFolders(api, folderPicker()), {
      wrapper: queryWrapper(queryClient),
    });

    act(() => folders.result.current.select('/library/notes'));
    await waitFor(() => expect(resolveNotes).toBeTypeOf('function'));
    act(() => folders.result.current.select('/library/writing'));
    await waitFor(() => expect(resolveWriting).toBeTypeOf('function'));
    await act(async () => resolveWriting?.(writing));

    await waitFor(() =>
      expect(queryClient.getQueryData(workspaceQueryKeys.library)).toEqual(writing),
    );

    await act(async () =>
      resolveNotes?.({
        ...initial,
        activeFolder: { name: 'Notes', path: '/library/notes' },
      }),
    );

    expect(queryClient.getQueryData(workspaceQueryKeys.library)).toEqual(writing);
  });
});
