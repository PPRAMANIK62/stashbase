import { describe, expect, it } from 'vite-plus/test';

import {
  createWorkspaceSessionSnapshot,
  normalizeWorkspaceSession,
  reconcileSessionMembership,
  recordFolderSession,
  setSessionActiveFolder,
  setSessionAgentPaneWidth,
  setSessionSidebarWidth,
} from './session';
import { createWorkspaceState } from './workspace';

const scope = {
  folder: { name: 'Notes', path: '/library/notes' },
  generation: 1,
};

describe('workspace session state', () => {
  it('records only approved serializable folder presentation and tab identities', () => {
    const state = {
      ...createWorkspaceState(scope),
      expanded: { drafts: true as const },
      selectedPath: 'drafts/plan.md',
    };
    const snapshot = recordFolderSession(
      setSessionActiveFolder(createWorkspaceSessionSnapshot(), '/library/notes'),
      state,
      {
        activeTabId: 'tab-1',
        tabs: [{ id: 'tab-1', path: 'drafts/plan.md' }],
      },
    );

    expect(snapshot).toEqual({
      activeFolderPath: '/library/notes',
      folders: [
        {
          activeTabId: 'tab-1',
          expandedPaths: ['drafts'],
          folderPath: '/library/notes',
          selectedPath: 'drafts/plan.md',
          tabs: [{ id: 'tab-1', path: 'drafts/plan.md' }],
        },
      ],
      shell: { agentPaneWidth: 576, sidebarOpen: true, sidebarWidth: 240 },
      version: 1,
    });
    expect(snapshot).not.toHaveProperty('scope');
    expect(snapshot).not.toHaveProperty('lifecycle');
  });

  it('bounds document identity projections at the Workspace persistence owner', () => {
    const state = createWorkspaceState(scope);
    const snapshot = recordFolderSession(createWorkspaceSessionSnapshot(), state, {
      activeTabId: 'tab-54',
      tabs: Array.from({ length: 55 }, (_, index) => ({
        id: `tab-${index}`,
        path: `${index}.md`,
      })),
    });

    expect(snapshot.folders[0]?.tabs).toHaveLength(50);
    expect(snapshot.folders[0]?.tabs[0]?.path).toBe('5.md');
    expect(snapshot.folders[0]?.activeTabId).toBe('tab-54');
  });

  it('normalizes duplicate identities and invalid active references', () => {
    const normalized = normalizeWorkspaceSession({
      activeFolderPath: '/library/missing',
      folders: [
        {
          activeTabId: 'missing-tab',
          expandedPaths: ['drafts', 'drafts'],
          folderPath: '/library/notes',
          selectedPath: null,
          tabs: [
            { id: 'tab-1', path: 'one.md' },
            { id: 'tab-1', path: 'two.md' },
          ],
        },
      ],
      shell: { agentPaneWidth: 576, sidebarOpen: false, sidebarWidth: 900 },
      version: 1,
    });

    expect(normalized.activeFolderPath).toBeNull();
    expect(normalized.folders[0]).toMatchObject({
      activeTabId: null,
      expandedPaths: ['drafts'],
      tabs: [{ id: 'tab-1', path: 'one.md' }],
    });
    expect(normalized.shell.sidebarWidth).toBe(360);
  });

  it('clamps the Agent pane width and keeps unchanged widths referentially stable', () => {
    const snapshot = createWorkspaceSessionSnapshot();
    expect(setSessionAgentPaneWidth(snapshot, 5_000).shell.agentPaneWidth).toBe(960);
    expect(setSessionAgentPaneWidth(snapshot, 10).shell.agentPaneWidth).toBe(320);
    expect(setSessionAgentPaneWidth(snapshot, 576)).toBe(snapshot);
  });

  it('prunes only sessions whose durable membership disappeared', () => {
    let snapshot = createWorkspaceSessionSnapshot();
    snapshot = setSessionActiveFolder(snapshot, '/library/notes');
    snapshot = setSessionActiveFolder(snapshot, '/library/writing');
    snapshot = setSessionSidebarWidth(snapshot, 100);

    expect(reconcileSessionMembership(snapshot, ['/library/writing'])).toMatchObject({
      activeFolderPath: '/library/writing',
      folders: [{ folderPath: '/library/writing' }],
      shell: { sidebarWidth: 160 },
    });
  });
});
