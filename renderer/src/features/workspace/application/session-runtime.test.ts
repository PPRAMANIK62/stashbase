import { describe, expect, it, vi } from 'vite-plus/test';

import type { WorkspaceSessionSnapshot } from '@/features/workspace/domain/session';
import { createWorkspaceState } from '@/features/workspace/domain/workspace';

import { createWorkspaceSessionRuntime } from './session-runtime';

describe('Workspace session runtime', () => {
  it('restores a normalized v1 snapshot without persisting the restore itself', async () => {
    const save = vi.fn(async (_snapshot: WorkspaceSessionSnapshot) => undefined);
    const runtime = createWorkspaceSessionRuntime({
      load: async () => ({
        activeFolderPath: '/library/notes',
        folders: [
          {
            activeTabId: 'missing',
            expandedPaths: ['drafts', 'drafts'],
            folderPath: '/library/notes',
            selectedPath: 'drafts/plan.md',
            tabs: [],
          },
        ],
        shell: { agentPaneWidth: 576, sidebarOpen: false, sidebarWidth: 288 },
        version: 1,
      }),
      save,
    });

    await runtime.restore();

    expect(runtime.store.getState()).toMatchObject({
      lifecycle: 'active',
      restoreStatus: 'ready',
      snapshot: {
        activeFolderPath: '/library/notes',
        folders: [{ activeTabId: null, expandedPaths: ['drafts'] }],
        shell: { agentPaneWidth: 576, sidebarOpen: false, sidebarWidth: 288 },
      },
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('preserves shell interaction that wins while asynchronous restore is pending', async () => {
    let finish!: (value: null) => void;
    const runtime = createWorkspaceSessionRuntime({
      load: () => new Promise((resolve) => (finish = resolve)),
      save: vi.fn(async (_snapshot: WorkspaceSessionSnapshot) => undefined),
    });

    const restoring = runtime.restore();
    runtime.setSidebarOpen(false);
    runtime.setSidebarWidth(310);
    finish(null);
    await restoring;

    expect(runtime.store.getState().snapshot.shell).toEqual({
      agentPaneWidth: 576,
      sidebarOpen: false,
      sidebarWidth: 310,
    });
  });

  it('coalesces approved changes and prunes removed folder state', async () => {
    const save = vi.fn(async (_snapshot: WorkspaceSessionSnapshot) => undefined);
    const runtime = createWorkspaceSessionRuntime({ load: async () => null, save });
    await runtime.restore();
    runtime.setActiveFolder('/library/notes');
    runtime.recordWorkspace({
      ...createWorkspaceState({
        folder: { name: 'Notes', path: '/library/notes' },
        generation: 4,
      }),
      expanded: { drafts: true },
    });
    runtime.reconcileMembership([]);
    await runtime.flush();

    expect(save).toHaveBeenCalled();
    expect(save.mock.calls.at(-1)?.[0]).toMatchObject({
      activeFolderPath: null,
      folders: [],
    });
  });

  it('rejects late restore completion after disposal', async () => {
    let finish!: (value: null) => void;
    const runtime = createWorkspaceSessionRuntime({
      load: () => new Promise((resolve) => (finish = resolve)),
      save: vi.fn(async (_snapshot: WorkspaceSessionSnapshot) => undefined),
    });
    const restoring = runtime.restore();
    runtime.dispose();
    finish(null);
    await restoring;

    expect(runtime.store.getState()).toMatchObject({
      lifecycle: 'disposed',
      restoreStatus: 'loading',
    });
  });
});
