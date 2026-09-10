import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { workspaceQueryKeys } from '@/features/workspace/application/queries';
import type { LibrarySnapshot } from '@/features/workspace/domain/library';
import {
  createWorkspaceSessionSnapshot,
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
      () =>
        useWorkspaceSession(
          api,
          sessionPersistence({ load: async () => persisted }),
          libraryLifecycle(),
        ),
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
      () =>
        useWorkspaceSession(
          api,
          sessionPersistence({ load: async () => persisted, save }),
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
      () =>
        useWorkspaceSession(
          api,
          sessionPersistence({ load: async () => persisted }),
          libraryLifecycle(),
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

/** A saved session naming `folderPath`, which is a current member. */
const savedSession = (folderPath: string) => ({
  ...createWorkspaceSessionSnapshot(),
  activeFolderPath: folderPath,
  folders: [
    {
      activeTabId: null,
      expandedPaths: [],
      folderPath,
      selectedPath: null,
      tabs: [],
    },
  ],
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

  it('prefers the folder the window was created for over the saved session', async () => {
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
    // The person just asked for this folder. The saved session is what a plain
    // relaunch wants, and it never gets opened here.
    expect(api.openFolder).toHaveBeenCalledWith(member.path, expect.any(AbortSignal));
  });

  it('holds the saved session until the desktop has answered', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(workspaceQueryKeys.library, bothMembers);
    const api = libraryApi({
      load: vi.fn(async () => bothMembers),
      openFolder: vi.fn(async () =>
        librarySnapshot({ ...bothMembers, activeFolder: { name: 'writing', path: writing.path } }),
      ),
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

    // The race the old shape lost: the session file is local and the claim is
    // an IPC round trip, so restoring first would bind the wrong folder to this
    // window before the desktop could name one.
    await waitFor(() => expect(claimInitialFolder).toHaveBeenCalled());
    expect(api.openFolder).not.toHaveBeenCalled();
    expect(hook.result.current.status.kind).toBe('restoring');

    await act(async () => answer?.(null));
    await waitFor(() =>
      expect(api.openFolder).toHaveBeenCalledWith(writing.path, expect.any(AbortSignal)),
    );
  });
});
