import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { workspaceQueryKeys } from '@/features/workspace/application/queries';
import type { LibrarySnapshot } from '@/features/workspace/domain/library';
import {
  createWorkspaceSessionSnapshot,
  type WorkspaceSessionSnapshot,
} from '@/features/workspace/domain/session';
import { libraryApi, librarySnapshot, sessionPersistence } from '@/test/fakes/workspace';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { useWorkspaceSession } from './use-workspace-session';

afterEach(cleanup);

const member = { favorite: false, openedAt: '2026-09-01T00:00:00.000Z', path: '/library/notes' };
const settled = librarySnapshot({
  activeFolder: null,
  homeDirectory: '/library',
  members: [member],
});

describe('workspace session restore', () => {
  it('reopens a persisted folder only through current authoritative membership', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(workspaceQueryKeys.library, settled);
    const opened = librarySnapshot({
      ...settled,
      activeFolder: { name: 'notes', path: member.path },
    });
    const api = libraryApi({
      load: vi.fn(async () => settled),
      openFolder: vi.fn(async () => opened),
    });
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
      () => useWorkspaceSession(api, sessionPersistence({ load: async () => persisted })),
      { wrapper: queryWrapper(queryClient) },
    );

    await waitFor(() =>
      expect(api.openFolder).toHaveBeenCalledWith(member.path, expect.any(AbortSignal)),
    );
    await waitFor(() =>
      expect(queryClient.getQueryData(workspaceQueryKeys.library)).toEqual(opened),
    );
    expect(hook.result.current.status).toMatchObject({
      kind: 'ready',
      restoredFolder: { expandedPaths: ['drafts'], selectedPath: 'drafts/plan.md' },
    });
  });

  it('drops a persisted folder that is no longer a library member', async () => {
    const queryClient = createTestQueryClient();
    const forgotten = librarySnapshot({ ...settled, members: [] });
    queryClient.setQueryData(workspaceQueryKeys.library, forgotten);
    const save = vi.fn(async (_snapshot: WorkspaceSessionSnapshot) => undefined);
    const api = libraryApi({
      load: vi.fn(async () => forgotten),
      openFolder: vi.fn(async () => {
        throw new Error('not expected');
      }),
      removeFolder: vi.fn(async () => {
        throw new Error('not expected');
      }),
    });
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

    const hook = renderHook(
      () => useWorkspaceSession(api, sessionPersistence({ load: async () => persisted, save })),
      { wrapper: queryWrapper(queryClient) },
    );

    await waitFor(() => expect(hook.result.current.status.kind).toBe('ready'));
    await act(async () => hook.result.current.runtime.flush());
    expect(api.openFolder).not.toHaveBeenCalled();
    expect(save.mock.calls.at(-1)?.[0]).toMatchObject({
      activeFolderPath: null,
      folders: [],
    });
  });

  it('does not let a late restore replace a newer explicit folder selection', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(workspaceQueryKeys.library, settled);
    let finish: ((value: LibrarySnapshot) => void) | undefined;
    const api = libraryApi({
      load: vi.fn(async () => settled),
      openFolder: vi.fn(
        () =>
          new Promise<LibrarySnapshot>((resolve) => {
            finish = resolve;
          }),
      ),
      removeFolder: vi.fn(async () => {
        throw new Error('not expected');
      }),
    });
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
    renderHook(
      () => useWorkspaceSession(api, sessionPersistence({ load: async () => persisted })),
      { wrapper: queryWrapper(queryClient) },
    );
    await waitFor(() => expect(api.openFolder).toHaveBeenCalledOnce());
    const writing = librarySnapshot({
      ...settled,
      activeFolder: { name: 'writing', path: '/library/writing' },
      members: [...settled.members, { ...member, path: '/library/writing' }],
    });
    act(() => queryClient.setQueryData(workspaceQueryKeys.library, writing));
    finish?.(librarySnapshot({ ...settled, activeFolder: { name: 'notes', path: member.path } }));

    await waitFor(() =>
      expect(queryClient.getQueryData(workspaceQueryKeys.library)).toEqual(writing),
    );
  });
});
