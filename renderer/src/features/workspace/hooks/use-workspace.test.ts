import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { workspaceQueryKeys } from '@/features/workspace/application/queries';
import { libraryApi, librarySnapshot } from '@/test/fakes/workspace';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { useWorkspace } from './use-workspace';

afterEach(cleanup);

describe('Workspace lifecycle', () => {
  it('retains one runtime per active folder and disposes it when scope changes', async () => {
    const queryClient = createTestQueryClient();
    const cancelQueries = vi.spyOn(queryClient, 'cancelQueries');
    const notes = librarySnapshot({
      activeFolder: { name: 'Notes', path: '/library/notes' },
      homeDirectory: '/library',
      members: [],
    });
    const api = libraryApi({ load: vi.fn(async () => notes) });
    queryClient.setQueryData(workspaceQueryKeys.library, notes);
    const workspace = renderHook(() => useWorkspace(api), {
      wrapper: queryWrapper(queryClient),
    });

    await waitFor(() => expect(workspace.result.current?.scope.folder.path).toBe('/library/notes'));
    const notesRuntime = workspace.result.current;

    act(() => queryClient.setQueryData(workspaceQueryKeys.library, { ...notes }));
    expect(workspace.result.current).toBe(notesRuntime);

    act(() =>
      queryClient.setQueryData(workspaceQueryKeys.library, {
        ...notes,
        activeFolder: { name: 'Writing', path: '/library/writing' },
      }),
    );

    await waitFor(() =>
      expect(workspace.result.current?.scope.folder.path).toBe('/library/writing'),
    );
    expect(workspace.result.current?.scope.generation).toBeGreaterThan(
      notesRuntime?.scope.generation ?? 0,
    );
    expect(notesRuntime?.signal.aborted).toBe(true);
    expect(notesRuntime?.store.getState().lifecycle).toBe('disposed');
    expect(cancelQueries).toHaveBeenCalledWith({
      queryKey: workspaceQueryKeys.folder('/library/notes'),
    });

    act(() =>
      queryClient.setQueryData(workspaceQueryKeys.library, { ...notes, activeFolder: null }),
    );
    await waitFor(() => expect(workspace.result.current).toBeNull());
  });
});
