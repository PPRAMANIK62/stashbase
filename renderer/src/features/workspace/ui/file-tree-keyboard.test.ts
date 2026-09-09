import { describe, expect, it } from 'vite-plus/test';

import { buildTree, visibleTree, type TreeRow } from '@/features/workspace/domain/tree';
import { listing, listingFolder } from '@/test/fakes/workspace';

import { treeKeyIntent, type TreeKeyContext } from './file-tree-keyboard';

const LISTING = listing(
  ['notes.md', 'docs/plan.md'],
  ['docs', listingFolder({ kind: 'excluded', path: 'vendor' })],
);

function rowsWith(expanded: Record<string, true>): TreeRow[] {
  return visibleTree(buildTree(LISTING), expanded);
}

function rowAt(rows: TreeRow[], path: string): TreeRow {
  const row = rows.find((candidate) => candidate.node.path === path);
  if (!row) throw new Error(`No row for ${path}`);
  return row;
}

function context(rows: TreeRow[], overrides: Partial<TreeKeyContext> = {}): TreeKeyContext {
  return { expanded: false, renderedRows: rows, restricted: false, rows, ...overrides };
}

describe('tree keyboard intents', () => {
  it('moves linearly over the rendered rows', () => {
    const rows = rowsWith({});
    const docs = rowAt(rows, 'docs');

    expect(treeKeyIntent('ArrowDown', docs, context(rows))).toEqual({
      kind: 'focus',
      path: 'vendor',
    });
    expect(treeKeyIntent('End', docs, context(rows))).toEqual({ kind: 'focus', path: 'notes.md' });
    expect(treeKeyIntent('Home', rowAt(rows, 'notes.md'), context(rows))).toEqual({
      kind: 'focus',
      path: 'docs',
    });
  });

  it('opens a closed folder, steps into an open one, and steps back out', () => {
    const closed = rowsWith({});
    const open = rowsWith({ docs: true });
    const docs = rowAt(open, 'docs');

    expect(treeKeyIntent('ArrowRight', rowAt(closed, 'docs'), context(closed))).toEqual({
      kind: 'toggle',
    });
    expect(treeKeyIntent('ArrowRight', docs, context(open, { expanded: true }))).toEqual({
      kind: 'focus',
      path: 'docs/plan.md',
    });
    expect(treeKeyIntent('ArrowLeft', docs, context(open, { expanded: true }))).toEqual({
      kind: 'toggle',
    });
    expect(treeKeyIntent('ArrowLeft', rowAt(open, 'docs/plan.md'), context(open))).toEqual({
      kind: 'focus',
      path: 'docs',
    });
    expect(treeKeyIntent('ArrowLeft', rowAt(open, 'notes.md'), context(open))).toEqual({
      kind: 'focus',
      path: null,
    });
  });

  it('offers editing keys only on an entry this window may edit', () => {
    const rows = rowsWith({});
    const notes = rowAt(rows, 'notes.md');
    const vendor = rowAt(rows, 'vendor');
    const restricted = context(rows, { restricted: true });

    expect(treeKeyIntent('F2', notes, context(rows))).toEqual({ kind: 'rename' });
    expect(treeKeyIntent('Delete', notes, context(rows))).toEqual({ kind: 'delete' });
    expect(treeKeyIntent('F2', vendor, restricted)).toEqual({ kind: 'none' });
    expect(treeKeyIntent('Delete', vendor, restricted)).toEqual({ kind: 'none' });
    // A restricted folder consumes the open key rather than opening.
    expect(treeKeyIntent('ArrowRight', vendor, restricted)).toEqual({ kind: 'consume' });
  });

  it('activates on Enter and Space, and leaves everything else to the browser', () => {
    const rows = rowsWith({});
    const notes = rowAt(rows, 'notes.md');

    expect(treeKeyIntent('Enter', notes, context(rows))).toEqual({ kind: 'activate' });
    expect(treeKeyIntent(' ', notes, context(rows))).toEqual({ kind: 'activate' });
    expect(treeKeyIntent('a', notes, context(rows))).toEqual({ kind: 'none' });
    expect(treeKeyIntent('ArrowRight', notes, context(rows))).toEqual({ kind: 'none' });
  });
});
