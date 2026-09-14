import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { workspaceQueryKeys } from '@/features/workspace/application/queries';
import type { ProjectRegistrySnapshot } from '@/features/workspace/domain/project';
import {
  createWorkspaceSessionSnapshot,
  type FolderSessionState,
  type WorkspaceSessionSnapshot,
} from '@/features/workspace/domain/session';
import {
  projectApi,
  projectLifecycle,
  projectRegistrySnapshot,
  sessionPersistence,
} from '@/test/fakes/workspace';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { useWorkspaceSession } from './use-workspace-session';

afterEach(cleanup);

const member = { favorite: false, openedAt: '2026-09-01T00:00:00.000Z', path: '/project/notes' };
const settled = projectRegistrySnapshot({
  activeFolder: null,
  homeDirectory: '/project',
  projects: [member],
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
    queryClient.setQueryData(workspaceQueryKeys.project, settled);
    const api = projectApi({
      load: vi.fn(async () => settled),
      openFolder: vi.fn(async () => {
        throw new Error('not expected');
      }),
    });

    const sidebarFrames: boolean[] = [];
    const hook = renderHook(
      () => {
        const controller = useWorkspaceSession(
          api,
          sessionPersistence({
            load: async () => ({
              ...savedSession(member.path, remembered),
              // Written while working in the folder with the column open.
              shell: { agentPaneWidth: 576, sidebarOpen: true, sidebarWidth: 240 },
            }),
          }),
          projectLifecycle(),
        );
        sidebarFrames.push(controller.shell.sidebarOpen);
        return controller;
      },
      { wrapper: queryWrapper(queryClient) },
    );

    await waitFor(() =>
      expect(hook.result.current.status).toEqual({ kind: 'ready', restoredFolder: null }),
    );
    expect(api.openFolder).not.toHaveBeenCalled();
    // Arriving at the welcome screen collapses the bare sidebar, and no render
    // on the way there shows it open first.
    expect(hook.result.current.shell.sidebarOpen).toBe(false);
    expect(sidebarFrames).not.toContain(true);
  });

  it('restores the saved folder session once that folder is open', async () => {
    // The server already holds the folder, as it does after a reload or once a
    // reader's click has landed, so what the session remembered about it comes
    // back with it.
    const queryClient = createTestQueryClient();
    const opened = projectRegistrySnapshot({
      ...settled,
      activeFolder: { name: 'notes', path: member.path },
    });
    queryClient.setQueryData(workspaceQueryKeys.project, opened);
    const api = projectApi({
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
          projectLifecycle(),
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
    // Landing back in the folder is not an arrival at the welcome screen, so
    // the column the reader had collapsed there stays collapsed.
    expect(hook.result.current.shell.sidebarOpen).toBe(false);
  });

  it('drops a persisted folder that is no longer a project member', async () => {
    const queryClient = createTestQueryClient();
    const forgotten = projectRegistrySnapshot({ ...settled, projects: [] });
    queryClient.setQueryData(workspaceQueryKeys.project, forgotten);
    const save = vi.fn(async (_snapshot: WorkspaceSessionSnapshot) => undefined);
    const api = projectApi({
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
          sessionPersistence({
            load: async () => ({
              ...savedSession(member.path),
              shell: { agentPaneWidth: 576, sidebarOpen: true, sidebarWidth: 240 },
            }),
            save,
          }),
          projectLifecycle(),
        ),
      { wrapper: queryWrapper(queryClient) },
    );

    await waitFor(() => expect(hook.result.current.status.kind).toBe('ready'));
    await act(async () => hook.result.current.runtime.flush());
    expect(api.openFolder).not.toHaveBeenCalled();
    // Its folder gone, the window is on the welcome screen, and arrives there
    // with the sidebar collapsed like any other.
    expect(save.mock.calls.at(-1)?.[0]).toMatchObject({
      activeFolderPath: null,
      folders: [],
      shell: { sidebarOpen: false },
    });
  });

  it('does not let a late open replace a newer explicit folder selection', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(workspaceQueryKeys.project, settled);
    let finish: ((value: ProjectRegistrySnapshot) => void) | undefined;
    const api = projectApi({
      load: vi.fn(async () => settled),
      openFolder: vi.fn(
        () =>
          new Promise<ProjectRegistrySnapshot>((resolve) => {
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
          projectLifecycle({ claimInitialFolder: vi.fn(async () => member.path) }),
        ),
      { wrapper: queryWrapper(queryClient) },
    );
    await waitFor(() => expect(api.openFolder).toHaveBeenCalledOnce());
    const writing = projectRegistrySnapshot({
      ...settled,
      activeFolder: { name: 'writing', path: '/project/writing' },
      projects: [...settled.projects, { ...member, path: '/project/writing' }],
    });
    act(() => queryClient.setQueryData(workspaceQueryKeys.project, writing));
    finish?.(
      projectRegistrySnapshot({ ...settled, activeFolder: { name: 'notes', path: member.path } }),
    );

    await waitFor(() =>
      expect(queryClient.getQueryData(workspaceQueryKeys.project)).toEqual(writing),
    );
  });
});

describe('initial folder landing', () => {
  const writing = { ...member, path: '/project/writing' };
  const bothMembers = projectRegistrySnapshot({ ...settled, projects: [member, writing] });

  it('opens the folder the window was created for', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(workspaceQueryKeys.project, settled);
    const opened = projectRegistrySnapshot({
      ...settled,
      activeFolder: { name: 'notes', path: member.path },
    });
    const api = projectApi({
      load: vi.fn(async () => settled),
      openFolder: vi.fn(async () => opened),
    });

    renderHook(
      () =>
        useWorkspaceSession(
          api,
          sessionPersistence(),
          projectLifecycle({ claimInitialFolder: vi.fn(async () => member.path) }),
        ),
      { wrapper: queryWrapper(queryClient) },
    );

    await waitFor(() =>
      expect(api.openFolder).toHaveBeenCalledWith(member.path, expect.any(AbortSignal)),
    );
    await waitFor(() =>
      expect(queryClient.getQueryData(workspaceQueryKeys.project)).toEqual(opened),
    );
  });

  it('leaves a window nobody named a folder for where it already was', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(workspaceQueryKeys.project, settled);
    const api = projectApi({
      load: vi.fn(async () => settled),
      openFolder: vi.fn(async () => {
        throw new Error('not expected');
      }),
    });

    const hook = renderHook(
      () => useWorkspaceSession(api, sessionPersistence(), projectLifecycle()),
      { wrapper: queryWrapper(queryClient) },
    );

    await waitFor(() =>
      expect(hook.result.current.status).toEqual({ kind: 'ready', restoredFolder: null }),
    );
    expect(api.openFolder).not.toHaveBeenCalled();
  });

  it('opens the folder the window was created for, not the saved session', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(workspaceQueryKeys.project, bothMembers);
    const opened = projectRegistrySnapshot({
      ...bothMembers,
      activeFolder: { name: 'notes', path: member.path },
    });
    const api = projectApi({
      load: vi.fn(async () => bothMembers),
      openFolder: vi.fn(async () => opened),
    });

    renderHook(
      () =>
        useWorkspaceSession(
          api,
          sessionPersistence({ load: async () => savedSession(writing.path) }),
          projectLifecycle({ claimInitialFolder: vi.fn(async () => member.path) }),
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
    queryClient.setQueryData(workspaceQueryKeys.project, bothMembers);
    const api = projectApi({
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
          projectLifecycle({ claimInitialFolder }),
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
