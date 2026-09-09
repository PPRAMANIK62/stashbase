import { describe, expect, it } from 'vite-plus/test';

import {
  createWorkspaceState,
  expandTreeFolder,
  forgetTreePath,
  renameTreePath,
  selectTreePath,
  toggleTreeFolder,
} from './workspace';

describe('workspace tree state', () => {
  it('keeps expansion and selection serializable and folder-scoped', () => {
    const initial = createWorkspaceState({
      folder: { name: 'Notes', path: '/library/notes' },
      generation: 3,
    });
    const expanded = toggleTreeFolder(initial, 'drafts');
    const selected = selectTreePath(expanded, 'drafts/plan.md');

    expect(selected).toMatchObject({
      expanded: { drafts: true },
      selectedPath: 'drafts/plan.md',
      scope: { folder: { path: '/library/notes' }, generation: 3 },
    });
    expect(toggleTreeFolder(selected, 'drafts').expanded).toEqual({});
    expect(initial).toMatchObject({ expanded: {}, selectedPath: null });
  });

  it('hydrates only approved tree state into a fresh runtime scope', () => {
    const restored = createWorkspaceState(
      {
        folder: { name: 'Notes', path: '/library/notes' },
        generation: 9,
      },
      {
        activeTabId: 'tab-1',
        expandedPaths: ['drafts'],
        folderPath: '/library/notes',
        selectedPath: 'drafts/plan.md',
        tabs: [{ id: 'tab-1', path: 'drafts/plan.md' }],
      },
    );

    expect(restored).toEqual({
      expanded: { drafts: true },
      lifecycle: 'active',
      scope: {
        folder: { name: 'Notes', path: '/library/notes' },
        generation: 9,
      },
      selectedPath: 'drafts/plan.md',
    });
  });

  it('moves expansion and selection with a renamed entry and drops them with a deleted one', () => {
    const scope = { folder: { name: 'Notes', path: '/library/notes' }, generation: 1 };
    let state = createWorkspaceState(scope);
    state = expandTreeFolder(expandTreeFolder(state, 'drafts'), 'drafts/2026');
    expect(expandTreeFolder(state, 'drafts')).toBe(state);
    state = selectTreePath(state, 'drafts/2026/plan.md');

    const renamed = renameTreePath(state, 'drafts', 'archive');
    expect(renamed.expanded).toEqual({ archive: true, 'archive/2026': true });
    expect(renamed.selectedPath).toBe('archive/2026/plan.md');
    expect(renameTreePath(state, 'drafts', 'drafts')).toBe(state);
    expect(renameTreePath(state, 'drafts-old', 'x')).toMatchObject({
      expanded: { drafts: true, 'drafts/2026': true },
      selectedPath: 'drafts/2026/plan.md',
    });

    const forgotten = forgetTreePath(state, 'drafts/2026');
    expect(forgotten.expanded).toEqual({ drafts: true });
    expect(forgotten.selectedPath).toBeNull();
    expect(forgetTreePath(state, 'other')).toMatchObject({
      expanded: { drafts: true, 'drafts/2026': true },
      selectedPath: 'drafts/2026/plan.md',
    });
  });
});
