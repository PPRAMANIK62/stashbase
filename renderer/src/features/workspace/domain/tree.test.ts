import { describe, expect, it } from 'vite-plus/test';

import type { WorkspaceListing } from './tree';
import { buildTree, fileIsRestricted, nextTreePath, visibleTree } from './tree';

const listing: WorkspaceListing = {
  files: [
    {
      availability: 'available',
      format: 'md',
      heading: '',
      importedAt: '',
      kind: 'regular',
      path: 'notes/chapter10.md',
      size: 10,
      snippet: '',
    },
    {
      availability: 'available',
      format: 'md',
      heading: '',
      importedAt: '',
      kind: 'regular',
      path: 'notes/chapter2.md',
      size: 2,
      snippet: '',
    },
    {
      availability: 'unreadable',
      format: 'generic',
      heading: '',
      importedAt: '',
      kind: 'special',
      path: 'socket',
      size: 0,
      snippet: '',
    },
  ],
  folderName: 'Research',
  folders: [
    { kind: 'excluded', path: 'vendor' },
    { kind: 'normal', path: 'notes/drafts' },
    { kind: 'normal', path: 'folder10' },
    { kind: 'normal', path: 'folder2' },
  ],
};

describe('workspace tree model', () => {
  it('builds implied parents and sorts folders before files with natural names', () => {
    const tree = buildTree(listing);

    expect(tree.map((node) => node.name)).toEqual([
      'folder2',
      'folder10',
      'notes',
      'vendor',
      'socket',
    ]);
    const notes = tree[2];
    expect(notes?.type).toBe('folder');
    if (notes?.type !== 'folder') throw new Error('Expected notes folder.');
    expect(notes.children.map((node) => node.name)).toEqual([
      'drafts',
      'chapter2.md',
      'chapter10.md',
    ]);
  });

  it('uses expanded state as the only source of visible order and hides restricted descendants', () => {
    const tree = buildTree({
      ...listing,
      files: [
        ...listing.files,
        {
          ...listing.files[0]!,
          path: 'vendor/private.md',
        },
      ],
    });

    expect(visibleTree(tree, {}).map((row) => row.node.path)).not.toContain('notes/chapter2.md');
    const rows = visibleTree(tree, { notes: true, vendor: true });
    expect(rows.map((row) => row.node.path)).toContain('notes/chapter2.md');
    expect(rows.map((row) => row.node.path)).not.toContain('vendor/private.md');
    expect(rows.find((row) => row.node.path === 'notes/chapter2.md')).toMatchObject({
      depth: 2,
      parentPath: 'notes',
      position: 2,
      setSize: 3,
    });
  });

  it('classifies non-regular and unreadable files as reveal-only', () => {
    expect(fileIsRestricted(listing.files[2]!)).toBe(true);
    expect(fileIsRestricted(listing.files[0]!)).toBe(false);
  });

  it('moves within the same visible rows used for rendering', () => {
    const rows = visibleTree(buildTree(listing), { notes: true });

    expect(nextTreePath('Home', 'notes', rows)).toBe('folder2');
    expect(nextTreePath('End', 'notes', rows)).toBe('socket');
    expect(nextTreePath('ArrowDown', 'notes', rows)).toBe('notes/drafts');
    expect(nextTreePath('ArrowUp', 'notes', rows)).toBe('folder10');
    expect(nextTreePath('PageDown', 'notes', rows)).toBeNull();
  });
});
