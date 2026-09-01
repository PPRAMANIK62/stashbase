import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { LibraryApi } from '@/features/workspace/application/ports';
import { libraryQueryKey } from '@/features/workspace/application/queries';
import type { LibrarySnapshot } from '@/features/workspace/domain/library';

import { useFolders } from './use-folders';

function queryWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

afterEach(cleanup);

describe('folder operation generations', () => {
  it('keeps the latest selection authoritative when an older request resolves last', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const initial: LibrarySnapshot = {
      activeFolder: { name: 'Research', path: '/library/research' },
      homeDirectory: '/library',
      members: [],
    };
    const writing: LibrarySnapshot = {
      ...initial,
      activeFolder: { name: 'Writing', path: '/library/writing' },
    };
    let resolveNotes: ((snapshot: LibrarySnapshot) => void) | undefined;
    let resolveWriting: ((snapshot: LibrarySnapshot) => void) | undefined;
    const openFolder = vi.fn((folderPath: string) => {
      return new Promise<LibrarySnapshot>((resolve) => {
        if (folderPath === '/library/notes') resolveNotes = resolve;
        if (folderPath === '/library/writing') resolveWriting = resolve;
      });
    });
    const api: LibraryApi = { load: vi.fn(), openFolder };
    queryClient.setQueryData(libraryQueryKey, initial);
    const folders = renderHook(() => useFolders(api, { chooseFolder: vi.fn() }), {
      wrapper: queryWrapper(queryClient),
    });

    act(() => folders.result.current.select('/library/notes'));
    await waitFor(() => expect(resolveNotes).toBeTypeOf('function'));
    act(() => folders.result.current.select('/library/writing'));
    await waitFor(() => expect(resolveWriting).toBeTypeOf('function'));
    await act(async () => resolveWriting?.(writing));

    await waitFor(() => expect(queryClient.getQueryData(libraryQueryKey)).toEqual(writing));

    await act(async () =>
      resolveNotes?.({
        ...initial,
        activeFolder: { name: 'Notes', path: '/library/notes' },
      }),
    );

    expect(queryClient.getQueryData(libraryQueryKey)).toEqual(writing);
  });
});
