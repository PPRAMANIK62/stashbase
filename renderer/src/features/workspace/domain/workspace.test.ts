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
});
