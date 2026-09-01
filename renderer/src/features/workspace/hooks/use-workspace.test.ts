import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { LibraryApi } from '@/features/workspace/application/ports';
import { libraryQueryKey, workspaceQueryKeys } from '@/features/workspace/application/queries';
import type { LibrarySnapshot } from '@/features/workspace/domain/library';

import { useWorkspace } from './use-workspace';

function queryWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

afterEach(cleanup);

describe('Workspace lifecycle', () => {
  it('retains one runtime per active folder and disposes it when scope changes', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const cancelQueries = vi.spyOn(queryClient, 'cancelQueries');
    const notes: LibrarySnapshot = {
      activeFolder: { name: 'Notes', path: '/library/notes' },
      homeDirectory: '/library',
      members: [],
    };
    const api: LibraryApi = { load: vi.fn(async () => notes), openFolder: vi.fn() };
    queryClient.setQueryData(libraryQueryKey, notes);
    const workspace = renderHook(() => useWorkspace(api), {
      wrapper: queryWrapper(queryClient),
    });

    await waitFor(() => expect(workspace.result.current?.scope.folder.path).toBe('/library/notes'));
    const notesRuntime = workspace.result.current;

    act(() => queryClient.setQueryData(libraryQueryKey, { ...notes }));
    expect(workspace.result.current).toBe(notesRuntime);

    act(() =>
      queryClient.setQueryData(libraryQueryKey, {
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

    act(() => queryClient.setQueryData(libraryQueryKey, { ...notes, activeFolder: null }));
    await waitFor(() => expect(workspace.result.current).toBeNull());
  });
});
