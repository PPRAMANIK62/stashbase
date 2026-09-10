import { describe, expect, it } from 'vite-plus/test';

import { buildTree, visibleTree, type TreeRow } from '@/features/workspace/domain/tree';
import { listing } from '@/test/fakes/workspace';

import { tabStopPath } from './file-tree-focus';
import { itemKey, nestTreeItems, treeItems } from './file-tree-model';

const ROWS: TreeRow[] = visibleTree(buildTree(listing(['notes.md', 'docs/plan.md'], ['docs'])), {
  docs: true,
});

describe('tree render model', () => {
  it('nests a folder’s rows under it so the group can move as one', () => {
    const nodes = nestTreeItems(treeItems(ROWS, null));

    expect(nodes.map((node) => itemKey(node.item))).toEqual(['docs', 'notes.md']);
    expect(nodes[0]?.children.map((node) => itemKey(node.item))).toEqual(['docs/plan.md']);
    expect(nodes[1]?.children).toEqual([]);
  });

  it('puts a new entry’s draft where the entry itself will land', () => {
    const underFolder = treeItems(ROWS, { entryKind: 'file', kind: 'create', parentPath: 'docs' });
    expect(underFolder.map(itemKey)).toEqual([
      'docs',
      'draft:file:docs',
      'docs/plan.md',
      'notes.md',
    ]);
    expect(nestTreeItems(underFolder)[0]?.children.map((node) => itemKey(node.item))).toEqual([
      'draft:file:docs',
      'docs/plan.md',
    ]);

    const atRoot = treeItems(ROWS, { entryKind: 'folder', kind: 'create', parentPath: '' });
    expect(atRoot.map(itemKey)[0]).toBe('draft:folder:');
    expect(nestTreeItems(atRoot)[0]?.item.kind).toBe('draft');
  });

  it('leaves a rename in place, since the row it renames is already there', () => {
    const items = treeItems(ROWS, { entry: { kind: 'file', path: 'notes.md' }, kind: 'rename' });
    expect(items.map(itemKey)).toEqual(['docs', 'docs/plan.md', 'notes.md']);
  });
});

describe('tree tab stop', () => {
  it('prefers where the user last moved, then the selection, then the first row', () => {
    expect(tabStopPath(ROWS, 'notes.md', 'docs')).toBe('notes.md');
    expect(tabStopPath(ROWS, null, 'docs/plan.md')).toBe('docs/plan.md');
    expect(tabStopPath(ROWS, null, null)).toBe('docs');
    // A path that has left the listing cannot hold the tab stop.
    expect(tabStopPath(ROWS, 'gone.md', 'also-gone.md')).toBe('docs');
    expect(tabStopPath([], 'notes.md', null)).toBeNull();
  });
});
