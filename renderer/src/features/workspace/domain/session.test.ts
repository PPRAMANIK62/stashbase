import { describe, expect, it } from 'vite-plus/test';

import {
  createWorkspaceSessionSnapshot,
  normalizeWorkspaceSession,
  reconcileSessionMembership,
  recordFolderSession,
  setSessionActiveFolder,
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
      activeTabId: 'tab-1',
      expanded: { drafts: true as const },
      selectedPath: 'drafts/plan.md',
      tabs: [{ id: 'tab-1', path: 'drafts/plan.md' }],
    };
    const snapshot = recordFolderSession(
      setSessionActiveFolder(createWorkspaceSessionSnapshot(), '/library/notes'),
      state,
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
      shell: { sidebarOpen: true, sidebarWidth: 240 },
      version: 1,
    });
    expect(snapshot).not.toHaveProperty('scope');
    expect(snapshot).not.toHaveProperty('lifecycle');
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
      shell: { sidebarOpen: false, sidebarWidth: 900 },
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
