import { describe, expect, it, vi } from 'vite-plus/test';

import { createRetainingTestQueryClient } from '@/test/query';

import { createWorkspaceQueryScope, workspaceQueryKeys } from './queries';

describe('Workspace query ownership', () => {
  it('cancels only the owned folder prefix and retains cached server state', async () => {
    const queryClient = createRetainingTestQueryClient();
    queryClient.setQueryData(workspaceQueryKeys.project, { activeFolder: null });
    queryClient.setQueryData([...workspaceQueryKeys.folder('/project/notes'), 'files'], ['a.md']);
    queryClient.setQueryData([...workspaceQueryKeys.folder('/project/writing'), 'files'], ['b.md']);
    const cancelQueries = vi.spyOn(queryClient, 'cancelQueries');

    await createWorkspaceQueryScope(queryClient, '/project/notes').cancel();

    expect(cancelQueries).toHaveBeenCalledWith({
      queryKey: workspaceQueryKeys.folder('/project/notes'),
    });
    expect(queryClient.getQueryData(workspaceQueryKeys.project)).toEqual({ activeFolder: null });
    expect(
      queryClient.getQueryData([...workspaceQueryKeys.folder('/project/notes'), 'files']),
    ).toEqual(['a.md']);
    expect(
      queryClient.getQueryData([...workspaceQueryKeys.folder('/project/writing'), 'files']),
    ).toEqual(['b.md']);
  });
});
