import { describe, expect, it } from 'vite-plus/test';

import { createWorkspaceState, selectTreePath, toggleTreeFolder } from './workspace';

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
});
