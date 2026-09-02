import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { LibraryApi } from '@/features/workspace/application/ports';
import { libraryQueryKey } from '@/features/workspace/application/queries';
import type { LibrarySnapshot } from '@/features/workspace/domain/library';
import {
  createWorkspaceSessionSnapshot,
  type WorkspaceSessionSnapshot,
} from '@/features/workspace/domain/session';

import { useWorkspaceSession } from './use-workspace-session';

afterEach(cleanup);

function wrapper(queryClient: QueryClient) {
  return ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

const member = { favorite: false, openedAt: '2026-09-01T00:00:00.000Z', path: '/library/notes' };
const settled = { activeFolder: null, homeDirectory: '/library', members: [member] };

describe('workspace session restore', () => {
  it('reopens a persisted folder only through current authoritative membership', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(libraryQueryKey, settled);
    const opened = { ...settled, activeFolder: { name: 'notes', path: member.path } };
    const api: LibraryApi = {
      load: vi.fn(async () => settled),
      openFolder: vi.fn(async () => opened),
      removeFolder: vi.fn(),
    };
    const persisted = {
      ...createWorkspaceSessionSnapshot(),
      activeFolderPath: member.path,
      folders: [
        {
          activeTabId: null,
          expandedPaths: ['drafts'],
          folderPath: member.path,
          selectedPath: 'drafts/plan.md',
          tabs: [],
        },
      ],
    };

    const hook = renderHook(
      () => useWorkspaceSession(api, { load: async () => persisted, save: vi.fn() }),
      { wrapper: wrapper(queryClient) },
    );

    await waitFor(() =>
      expect(api.openFolder).toHaveBeenCalledWith(member.path, expect.any(AbortSignal)),
    );
    await waitFor(() => expect(queryClient.getQueryData(libraryQueryKey)).toEqual(opened));
    expect(hook.result.current.restoredFolder).toMatchObject({
      expandedPaths: ['drafts'],
      selectedPath: 'drafts/plan.md',
    });
  });

  it('drops a persisted folder that is no longer a library member', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(libraryQueryKey, { ...settled, members: [] });
    const save = vi.fn(async (_snapshot: WorkspaceSessionSnapshot) => undefined);
    const api: LibraryApi = {
      load: vi.fn(async () => ({ ...settled, members: [] })),
      openFolder: vi.fn(async () => {
        throw new Error('not expected');
      }),
      removeFolder: vi.fn(async () => {
        throw new Error('not expected');
      }),
    };
    const persisted = {
      ...createWorkspaceSessionSnapshot(),
      activeFolderPath: member.path,
      folders: [
        {
          activeTabId: null,
          expandedPaths: [],
          folderPath: member.path,
          selectedPath: null,
          tabs: [],
        },
      ],
    };

    const hook = renderHook(() => useWorkspaceSession(api, { load: async () => persisted, save }), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => expect(hook.result.current.isRestoringFolder).toBe(false));
    await act(async () => hook.result.current.runtime.flush());
    expect(api.openFolder).not.toHaveBeenCalled();
    expect(save.mock.calls.at(-1)?.[0]).toMatchObject({
      activeFolderPath: null,
      folders: [],
    });
  });

  it('does not let a late restore replace a newer explicit folder selection', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(libraryQueryKey, settled);
    let finish!: (value: LibrarySnapshot) => void;
    const api: LibraryApi = {
      load: vi.fn(async () => settled),
      openFolder: vi.fn(() => new Promise<LibrarySnapshot>((resolve) => (finish = resolve))),
      removeFolder: vi.fn(async () => {
        throw new Error('not expected');
      }),
    };
    const persisted = {
      ...createWorkspaceSessionSnapshot(),
      activeFolderPath: member.path,
      folders: [
        {
          activeTabId: null,
          expandedPaths: [],
          folderPath: member.path,
          selectedPath: null,
          tabs: [],
        },
      ],
    };
    renderHook(() => useWorkspaceSession(api, { load: async () => persisted, save: vi.fn() }), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(api.openFolder).toHaveBeenCalledOnce());
    const writing = {
      ...settled,
      activeFolder: { name: 'writing', path: '/library/writing' },
      members: [...settled.members, { ...member, path: '/library/writing' }],
    };
    act(() => queryClient.setQueryData(libraryQueryKey, writing));
    finish({ ...settled, activeFolder: { name: 'notes', path: member.path } });

    await waitFor(() => expect(queryClient.getQueryData(libraryQueryKey)).toEqual(writing));
  });
});
