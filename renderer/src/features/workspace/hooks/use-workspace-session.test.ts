import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { workspaceQueryKeys } from '@/features/workspace/application/queries';
import type { LibrarySnapshot } from '@/features/workspace/domain/library';
import {
  createWorkspaceSessionSnapshot,
  type FolderSessionState,
  type WorkspaceSessionSnapshot,
} from '@/features/workspace/domain/session';
import {
  libraryApi,
  libraryLifecycle,
  librarySnapshot,
  sessionPersistence,
} from '@/test/fakes/workspace';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { useWorkspaceSession } from './use-workspace-session';

afterEach(cleanup);

const member = { favorite: false, openedAt: '2026-09-01T00:00:00.000Z', path: '/library/notes' };
const settled = librarySnapshot({
  activeFolder: null,
  homeDirectory: '/library',
  members: [member],
});

/** A saved session naming `folderPath`, which is a current member, and
 *  remembering whatever `folder` says it had expanded, selected, or open. */
const savedSession = (folderPath: string, folder: Partial<FolderSessionState> = {}) => ({
  ...createWorkspaceSessionSnapshot(),
  activeFolderPath: folderPath,
  folders: [
    {
      activeTabId: null,
      expandedPaths: [],
      folderPath,
      selectedPath: null,
      tabs: [],
      ...folder,
    },
  ],
});

const remembered = { expandedPaths: ['drafts'], selectedPath: 'drafts/plan.md' };

describe('workspace session restore', () => {
  it('lands on the welcome screen rather than reopening the saved folder', async () => {
    // A plain relaunch: the desktop names no folder, and the session file
    // remembers the one that was open. The window lands empty all the same.
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(workspaceQueryKeys.library, settled);
    const api = libraryApi({
      load: vi.fn(async () => settled),
      openFolder: vi.fn(async () => {
        throw new Error('not expected');
      }),
    });

    const hook = renderHook(
      () =>
        useWorkspaceSession(
          api,
          sessionPersistence({ load: async () => savedSession(member.path, remembered) }),
          libraryLifecycle(),
        ),
      { wrapper: queryWrapper(queryClient) },
    );

    await waitFor(() =>
      expect(hook.result.current.status).toEqual({ kind: 'ready', restoredFolder: null }),
    );
    expect(api.openFolder).not.toHaveBeenCalled();
  });

  it('restores the saved folder session once that folder is open', async () => {
    // The server already holds the folder, as it does after a reload or once a
    // reader's click has landed, so what the session remembered about it comes
    // back with it.
    const queryClient = createTestQueryClient();
    const opened = librarySnapshot({
      ...settled,
      activeFolder: { name: 'notes', path: member.path },
    });
    queryClient.setQueryData(workspaceQueryKeys.library, opened);
    const api = libraryApi({
      load: vi.fn(async () => opened),
      openFolder: vi.fn(async () => {
        throw new Error('not expected');
      }),
    });

    const hook = renderHook(
      () =>
        useWorkspaceSession(
          api,
          sessionPersistence({ load: async () => savedSession(member.path, remembered) }),
          libraryLifecycle(),
        ),
      { wrapper: queryWrapper(queryClient) },
    );

    await waitFor(() =>
      expect(hook.result.current.status).toMatchObject({
        kind: 'ready',
        restoredFolder: remembered,
      }),
    );
    expect(api.openFolder).not.toHaveBeenCalled();
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

    const hook = renderHook(
      () =>
        useWorkspaceSession(
          api,
          sessionPersistence({ load: async () => savedSession(member.path), save }),
          libraryLifecycle(),
        ),
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

  it('does not let a late open replace a newer explicit folder selection', async () => {
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
    renderHook(
      () =>
        useWorkspaceSession(
          api,
          sessionPersistence(),
          libraryLifecycle({ claimInitialFolder: vi.fn(async () => member.path) }),
        ),
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

describe('initial folder landing', () => {
  const writing = { ...member, path: '/library/writing' };
  const bothMembers = librarySnapshot({ ...settled, members: [member, writing] });

  it('opens the folder the window was created for', async () => {
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

    renderHook(
      () =>
        useWorkspaceSession(
          api,
          sessionPersistence(),
          libraryLifecycle({ claimInitialFolder: vi.fn(async () => member.path) }),
        ),
      { wrapper: queryWrapper(queryClient) },
    );

    await waitFor(() =>
      expect(api.openFolder).toHaveBeenCalledWith(member.path, expect.any(AbortSignal)),
    );
    await waitFor(() =>
      expect(queryClient.getQueryData(workspaceQueryKeys.library)).toEqual(opened),
    );
  });

  it('leaves a window nobody named a folder for where it already was', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(workspaceQueryKeys.library, settled);
    const api = libraryApi({
      load: vi.fn(async () => settled),
      openFolder: vi.fn(async () => {
        throw new Error('not expected');
      }),
    });

    const hook = renderHook(
      () => useWorkspaceSession(api, sessionPersistence(), libraryLifecycle()),
      { wrapper: queryWrapper(queryClient) },
    );

    await waitFor(() =>
      expect(hook.result.current.status).toEqual({ kind: 'ready', restoredFolder: null }),
    );
    expect(api.openFolder).not.toHaveBeenCalled();
  });

  it('opens the folder the window was created for, not the saved session', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(workspaceQueryKeys.library, bothMembers);
    const opened = librarySnapshot({
      ...bothMembers,
      activeFolder: { name: 'notes', path: member.path },
    });
    const api = libraryApi({
      load: vi.fn(async () => bothMembers),
      openFolder: vi.fn(async () => opened),
    });

    renderHook(
      () =>
        useWorkspaceSession(
          api,
          sessionPersistence({ load: async () => savedSession(writing.path) }),
          libraryLifecycle({ claimInitialFolder: vi.fn(async () => member.path) }),
        ),
      { wrapper: queryWrapper(queryClient) },
    );

    await waitFor(() => expect(api.openFolder).toHaveBeenCalledOnce());
    // The person just asked for this folder. The one the session remembers is
    // never opened on their behalf.
    expect(api.openFolder).toHaveBeenCalledWith(member.path, expect.any(AbortSignal));
  });

  it('shows nothing until the desktop has answered, then the welcome screen', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(workspaceQueryKeys.library, bothMembers);
    const api = libraryApi({
      load: vi.fn(async () => bothMembers),
      openFolder: vi.fn(async () => {
        throw new Error('not expected');
      }),
    });
    let answer: ((folderPath: string | null) => void) | undefined;
    const claimInitialFolder = vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          answer = resolve;
        }),
    );

    const hook = renderHook(
      () =>
        useWorkspaceSession(
          api,
          sessionPersistence({ load: async () => savedSession(writing.path) }),
          libraryLifecycle({ claimInitialFolder }),
        ),
      { wrapper: queryWrapper(queryClient) },
    );

    // The session file is local and the claim is an IPC round trip. Neither
    // the welcome screen nor a folder may show before the desktop has said
    // whether this window was made for one.
    await waitFor(() => expect(claimInitialFolder).toHaveBeenCalled());
    expect(hook.result.current.status.kind).toBe('restoring');

    await act(async () => answer?.(null));
    await waitFor(() =>
      expect(hook.result.current.status).toEqual({ kind: 'ready', restoredFolder: null }),
    );
    expect(api.openFolder).not.toHaveBeenCalled();
  });
});
