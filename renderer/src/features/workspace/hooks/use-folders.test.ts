import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { workspaceQueryKeys } from '@/features/workspace/application/queries';
import type { ProjectRegistrySnapshot } from '@/features/workspace/domain/project';
import { folderPicker, projectApi, projectRegistrySnapshot } from '@/test/fakes/workspace';
import { createRetainingTestQueryClient, createTestQueryClient, queryWrapper } from '@/test/query';

import { useFolders } from './use-folders';

afterEach(cleanup);

describe('folder operation generations', () => {
  it('keeps the active folder when the document save barrier fails', async () => {
    const queryClient = createTestQueryClient();
    const openFolder = vi.fn();
    const beforeFolderChange = vi.fn(async () => false);
    const api = projectApi({ openFolder });
    const folders = renderHook(() => useFolders(api, folderPicker(), beforeFolderChange), {
      wrapper: queryWrapper(queryClient),
    });

    act(() => folders.result.current.select('/project/notes'));

    await waitFor(() => expect(folders.result.current.isPending).toBe(false));
    expect(beforeFolderChange).toHaveBeenCalledOnce();
    expect(openFolder).not.toHaveBeenCalled();
    expect(folders.result.current.failure).toContain('document could not be saved');
  });

  it('keeps the latest selection authoritative when an older request resolves last', async () => {
    const queryClient = createRetainingTestQueryClient();
    const initial = projectRegistrySnapshot({
      activeFolder: { name: 'Research', path: '/project/research' },
      homeDirectory: '/project',
      projects: [],
    });
    const writing = projectRegistrySnapshot({
      ...initial,
      activeFolder: { name: 'Writing', path: '/project/writing' },
    });
    let resolveNotes: ((snapshot: ProjectRegistrySnapshot) => void) | undefined;
    let resolveWriting: ((snapshot: ProjectRegistrySnapshot) => void) | undefined;
    const openFolder = vi.fn((folderPath: string) => {
      return new Promise<ProjectRegistrySnapshot>((resolve) => {
        if (folderPath === '/project/notes') resolveNotes = resolve;
        if (folderPath === '/project/writing') resolveWriting = resolve;
      });
    });
    const api = projectApi({ openFolder });
    queryClient.setQueryData(workspaceQueryKeys.project, initial);
    const folders = renderHook(() => useFolders(api, folderPicker()), {
      wrapper: queryWrapper(queryClient),
    });

    act(() => folders.result.current.select('/project/notes'));
    await waitFor(() => expect(resolveNotes).toBeTypeOf('function'));
    act(() => folders.result.current.select('/project/writing'));
    await waitFor(() => expect(resolveWriting).toBeTypeOf('function'));
    await act(async () => resolveWriting?.(writing));

    await waitFor(() =>
      expect(queryClient.getQueryData(workspaceQueryKeys.project)).toEqual(writing),
    );

    await act(async () =>
      resolveNotes?.({
        ...initial,
        activeFolder: { name: 'Notes', path: '/project/notes' },
      }),
    );

    expect(queryClient.getQueryData(workspaceQueryKeys.project)).toEqual(writing);
  });
});
