import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { workspaceQueryKeys } from '@/features/workspace/application/queries';
import { projectApi, projectRegistrySnapshot } from '@/test/fakes/workspace';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { useWorkspace } from './use-workspace';

afterEach(cleanup);

describe('Workspace lifecycle', () => {
  it('retains one runtime per active folder and disposes it when scope changes', async () => {
    const queryClient = createTestQueryClient();
    const cancelQueries = vi.spyOn(queryClient, 'cancelQueries');
    const notes = projectRegistrySnapshot({
      activeFolder: { name: 'Notes', path: '/project/notes' },
      homeDirectory: '/project',
      projects: [],
    });
    const api = projectApi({ load: vi.fn(async () => notes) });
    queryClient.setQueryData(workspaceQueryKeys.project, notes);
    const workspace = renderHook(() => useWorkspace(api), {
      wrapper: queryWrapper(queryClient),
    });

    await waitFor(() => expect(workspace.result.current?.scope.folder.path).toBe('/project/notes'));
    const notesRuntime = workspace.result.current;

    act(() => queryClient.setQueryData(workspaceQueryKeys.project, { ...notes }));
    expect(workspace.result.current).toBe(notesRuntime);

    act(() =>
      queryClient.setQueryData(workspaceQueryKeys.project, {
        ...notes,
        activeFolder: { name: 'Writing', path: '/project/writing' },
      }),
    );

    await waitFor(() =>
      expect(workspace.result.current?.scope.folder.path).toBe('/project/writing'),
    );
    expect(workspace.result.current?.scope.generation).toBeGreaterThan(
      notesRuntime?.scope.generation ?? 0,
    );
    expect(notesRuntime?.signal.aborted).toBe(true);
    expect(notesRuntime?.store.getState().lifecycle).toBe('disposed');
    expect(cancelQueries).toHaveBeenCalledWith({
      queryKey: workspaceQueryKeys.folder('/project/notes'),
    });

    act(() =>
      queryClient.setQueryData(workspaceQueryKeys.project, { ...notes, activeFolder: null }),
    );
    await waitFor(() => expect(workspace.result.current).toBeNull());
  });
});
