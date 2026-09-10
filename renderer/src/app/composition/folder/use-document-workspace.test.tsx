import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';

import { useWorkspaceSession } from '@/features/workspace/public';
import { createWorkspaceRuntime } from '@/features/workspace/test-support';
import { pendingSourceApi, recoveryApi } from '@/test/fakes/documents';
import {
  folderSession,
  libraryApi,
  RESEARCH_FOLDER,
  sessionPersistence,
  workspaceRuntimeOptions,
} from '@/test/fakes/workspace';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { useDocumentWorkspace } from './use-document-workspace';

const restored = folderSession({
  activeTabId: 'restored-tab',
  tabs: [{ id: 'restored-tab', path: 'plan.md' }],
});

describe('document workspace composition', () => {
  it('hydrates document identities, records tab changes, and disposes with the folder scope', async () => {
    const persistence = sessionPersistence({
      load: async () => ({
        activeFolderPath: RESEARCH_FOLDER.path,
        folders: [restored],
        shell: { agentPaneWidth: 576, sidebarOpen: true, sidebarWidth: 300 },
        version: 1,
      }),
    });
    const save = vi.mocked(persistence.save);
    const workspace = createWorkspaceRuntime(
      workspaceRuntimeOptions({ folder: RESEARCH_FOLDER, generation: 2 }),
    );
    let nextId = 0;
    const createId = () => `new-tab-${++nextId}`;
    const api = pendingSourceApi();
    const recovery = recoveryApi();
    const library = libraryApi();

    // The session is reached through the app's own wiring, so the tabs this
    // hook records land in the same snapshot the running window would save.
    const { result, rerender } = renderHook(
      ({ currentWorkspace }) => {
        const session = useWorkspaceSession(library, persistence);
        // The shell only mounts a workspace once the session has settled;
        // the tabs runtime is built from whatever it restored.
        const live = session.status.kind === 'ready' ? currentWorkspace : null;
        return { documents: useDocumentWorkspace(live, session, api, createId, recovery), session };
      },
      {
        initialProps: { currentWorkspace: workspace as typeof workspace | null },
        wrapper: queryWrapper(createTestQueryClient()),
      },
    );

    await waitFor(() =>
      expect(result.current.documents?.activeSource()).toEqual({
        folderPath: RESEARCH_FOLDER.path,
        path: 'plan.md',
      }),
    );
    const restoredDocument = result.current.documents?.getDocument('restored-tab');
    await act(async () => {
      await result.current.documents?.open({
        folderPath: RESEARCH_FOLDER.path,
        path: 'other.md',
      });
    });
    await act(async () => result.current.session.runtime.flush());

    expect(save.mock.calls.at(-1)?.[0].folders[0]?.tabs).toEqual([
      { id: 'restored-tab', path: 'plan.md' },
      { id: 'new-tab-1', path: 'other.md' },
    ]);

    rerender({ currentWorkspace: null });
    expect(restoredDocument?.signal.aborted).toBe(true);
  });
});
