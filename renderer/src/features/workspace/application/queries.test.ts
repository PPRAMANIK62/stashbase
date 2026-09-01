import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vite-plus/test';

import { createWorkspaceQueryScope, libraryQueryKey, workspaceQueryKeys } from './queries';

describe('Workspace query ownership', () => {
  it('cancels only the owned folder prefix and retains cached server state', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(libraryQueryKey, { activeFolder: null });
    queryClient.setQueryData([...workspaceQueryKeys.folder('/library/notes'), 'files'], ['a.md']);
    queryClient.setQueryData([...workspaceQueryKeys.folder('/library/writing'), 'files'], ['b.md']);
    const cancelQueries = vi.spyOn(queryClient, 'cancelQueries');

    await createWorkspaceQueryScope(queryClient, '/library/notes').cancel();

    expect(cancelQueries).toHaveBeenCalledWith({
      queryKey: workspaceQueryKeys.folder('/library/notes'),
    });
    expect(queryClient.getQueryData(libraryQueryKey)).toEqual({ activeFolder: null });
    expect(
      queryClient.getQueryData([...workspaceQueryKeys.folder('/library/notes'), 'files']),
    ).toEqual(['a.md']);
    expect(
      queryClient.getQueryData([...workspaceQueryKeys.folder('/library/writing'), 'files']),
    ).toEqual(['b.md']);
  });
});
