import { describe, expect, it, vi } from 'vite-plus/test';

import { createRetainingTestQueryClient } from '@/test/query';

import { createWorkspaceQueryScope, workspaceQueryKeys } from './queries';

describe('Workspace query ownership', () => {
  it('cancels only the owned folder prefix and retains cached server state', async () => {
    const queryClient = createRetainingTestQueryClient();
    queryClient.setQueryData(workspaceQueryKeys.library, { activeFolder: null });
    queryClient.setQueryData([...workspaceQueryKeys.folder('/library/notes'), 'files'], ['a.md']);
    queryClient.setQueryData([...workspaceQueryKeys.folder('/library/writing'), 'files'], ['b.md']);
    const cancelQueries = vi.spyOn(queryClient, 'cancelQueries');

    await createWorkspaceQueryScope(queryClient, '/library/notes').cancel();

    expect(cancelQueries).toHaveBeenCalledWith({
      queryKey: workspaceQueryKeys.folder('/library/notes'),
    });
    expect(queryClient.getQueryData(workspaceQueryKeys.library)).toEqual({ activeFolder: null });
    expect(
      queryClient.getQueryData([...workspaceQueryKeys.folder('/library/notes'), 'files']),
    ).toEqual(['a.md']);
    expect(
      queryClient.getQueryData([...workspaceQueryKeys.folder('/library/writing'), 'files']),
    ).toEqual(['b.md']);
  });
});
