import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChevronDown, ChevronRight, FileQuestion, FileText, FileType2, Folder } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  buildTree,
  visibleTree,
  type ExpandedFolders,
  type TreeRow,
} from '@/features/workspace/domain/tree';
import { SOURCE_DRAG_MIME } from '@/shared/utils/source-drag';
import { listing, listingFile, listingFolder, RESEARCH_FOLDER } from '@/test/fakes/workspace';

import {
  entryOf,
  FileTreeRow,
  nameSelection,
  Rails,
  rowIcon,
  rowInset,
  rowIsRestricted,
  type FileTreeRowProps,
} from './file-tree-rows';

const LISTING = listing(
  [
    listingFile({ path: 'docs/plan.md' }),
    listingFile({ format: 'generic', path: 'archive.zip' }),
    listingFile({ format: 'generic', kind: 'symlink', path: 'linked-file' }),
    listingFile({ format: 'pdf', path: 'deep/nested/paper.pdf' }),
    listingFile({ format: 'txt', path: '.env' }),
  ],
  ['docs', 'deep', 'deep/nested', listingFolder({ kind: 'excluded', path: 'vendor' })],
);

const EXPANDED: ExpandedFolders = { deep: true, 'deep/nested': true, docs: true };

/** Every row the tree would show with all normal folders open, so a test
 *  names the one it wants by path rather than hand-building a node. */
function rowFor(path: string, expanded: ExpandedFolders = EXPANDED): TreeRow {
  const row = visibleTree(buildTree(LISTING), expanded).find((entry) => entry.node.path === path);
  if (!row) throw new Error(`No visible row for ${path}.`);
  return row;
}

interface RowOverrides {
  expanded?: boolean;
  index?: number;
  marker?: FileTreeRowProps['marker'];
  proximityActive?: boolean;
  selected?: boolean;
  tabStop?: boolean;
}

function renderRow(row: TreeRow, overrides: RowOverrides = {}) {
  const spies = {
    onActivate: vi.fn<FileTreeRowProps['onActivate']>(),
    onFocus: vi.fn<FileTreeRowProps['onFocus']>(),
    onKeyDown: vi.fn<FileTreeRowProps['onKeyDown']>(),
    onRename: vi.fn<FileTreeRowProps['onRename']>(),
    registerRow: vi.fn<FileTreeRowProps['registerRow']>(),
  };
  const view = render(
    <FileTreeRow
      {...spies}
      expanded={overrides.expanded ?? false}
      folderPath={RESEARCH_FOLDER.path}
      index={overrides.index ?? 0}
      marker={overrides.marker}
      proximityActive={overrides.proximityActive ?? false}
      revealLabel="Show in file manager"
      row={row}
      selected={overrides.selected ?? false}
      tabStop={overrides.tabStop ?? false}
    />,
  );
  return { ...spies, view };
}

/** The one row the harness rendered, whatever it announces itself as. */
function rowElement(): HTMLElement {
  return screen.getAllByRole('treeitem')[0] ?? screen.getByRole('treeitem');
}

function dragTransfer() {
  const data = new Map<string, string>();
  return {
    data,
    dataTransfer: {
      effectAllowed: 'none',
      setData: (type: string, value: string) => void data.set(type, value),
    },
  };
}

afterEach(cleanup);

describe('file tree row geometry', () => {
  it('indents each level by one fixed step from the root inset', () => {
    expect(rowInset(1)).toEqual({ paddingLeft: '8px' });
    expect(rowInset(2)).toEqual({ paddingLeft: '34px' });
    expect(rowInset(3)).toEqual({ paddingLeft: '60px' });
  });

  it('draws one decorative rail per ancestor and none at the root', () => {
    const { container } = render(<Rails depth={3} />);
    // Rails are aria-hidden guides with no role or label, so the count is only
    // readable from the marker the component publishes for them.
    expect(container.querySelectorAll('[data-tree-rail]')).toHaveLength(2); // dom-contract: see comment above

    cleanup();
    const root = render(<Rails depth={1} />);
    expect(root.container.querySelectorAll('[data-tree-rail]')).toHaveLength(0); // dom-contract: see comment above
  });
});

describe('file tree row model', () => {
  it('reduces a row to the entry a mutation acts on', () => {
    expect(entryOf(rowFor('docs/plan.md'))).toEqual({ kind: 'file', path: 'docs/plan.md' });
    expect(entryOf(rowFor('docs'))).toEqual({ kind: 'folder', path: 'docs' });
  });

  it('calls an entry restricted only when the library cannot read through it', () => {
    expect(rowIsRestricted(rowFor('vendor'))).toBe(true);
    expect(rowIsRestricted(rowFor('linked-file'))).toBe(true);
    expect(rowIsRestricted(rowFor('docs'))).toBe(false);
    expect(rowIsRestricted(rowFor('archive.zip'))).toBe(false);
  });

  it('offers a rename the stem of a file and the whole name of a folder', () => {
    expect(nameSelection(rowFor('docs/plan.md'))).toEqual({ end: 4, start: 0 });
    expect(nameSelection(rowFor('docs'))).toEqual({ end: 4, start: 0 });
    expect(nameSelection(rowFor('linked-file'))).toEqual({ end: 11, start: 0 });
    expect(nameSelection(rowFor('.env'))).toEqual({ end: 4, start: 0 });
  });

  it('picks a disclosure glyph for a folder and a format glyph for a file', () => {
    expect(rowIcon(rowFor('docs'), false)).toBe(ChevronRight);
    expect(rowIcon(rowFor('docs'), true)).toBe(ChevronDown);
    expect(rowIcon(rowFor('vendor'), true)).toBe(Folder);
    expect(rowIcon(rowFor('docs/plan.md'), false)).toBe(FileText);
    expect(rowIcon(rowFor('deep/nested/paper.pdf'), false)).toBe(FileType2);
    expect(rowIcon(rowFor('archive.zip'), false)).toBe(FileQuestion);
  });
});

describe('file tree row semantics', () => {
  it('places a nested file in the tree and names it by itself', () => {
    renderRow(rowFor('deep/nested/paper.pdf'), { index: 4, tabStop: true });

    const row = screen.getByRole('treeitem', { name: 'paper.pdf' });
    expect(row.getAttribute('aria-level')).toBe('3');
    expect(row.getAttribute('aria-posinset')).toBe('1');
    expect(row.getAttribute('aria-setsize')).toBe('1');
    expect(row.getAttribute('data-proximity-index')).toBe('4');
    expect(row.getAttribute('data-path')).toBe('deep/nested/paper.pdf');
    expect(row.getAttribute('aria-expanded')).toBeNull();
    expect(row.title).toBe('deep/nested/paper.pdf');
    expect(row.style.paddingLeft).toBe('60px');
    expect(row.tabIndex).toBe(0);
  });

  it('keeps an unselected row from claiming hover and stays off the tab order', () => {
    const { view } = renderRow(rowFor('docs/plan.md'));
    expect(rowElement().style.getPropertyValue('--hover')).toBe('transparent');
    expect(rowElement().tabIndex).toBe(-1);
    expect(rowElement().getAttribute('aria-selected')).toBe('false');

    view.unmount();
    renderRow(rowFor('docs/plan.md'), { selected: true });
    expect(rowElement().style.getPropertyValue('--hover')).toBe('');
    expect(rowElement().getAttribute('aria-selected')).toBe('true');
  });

  it('publishes a normal folder disclosure state and withholds it from a restricted one', () => {
    const { view } = renderRow(rowFor('docs'), { expanded: true });
    expect(screen.getByRole('treeitem', { name: 'docs' }).getAttribute('aria-expanded')).toBe(
      'true',
    );

    view.unmount();
    renderRow(rowFor('vendor'), { expanded: true });
    const restricted = screen.getByRole('treeitem', {
      name: 'vendor, restricted, Show in file manager',
    });
    expect(restricted.hasAttribute('aria-expanded')).toBe(false);
    expect(restricted.title).toBe('Show in file manager');
  });

  it('explains a file Search cannot see', () => {
    renderRow(rowFor('archive.zip'));

    const row = screen.getByRole('treeitem', {
      name: 'archive.zip, excluded from Search and automatic Chat context',
    });
    expect(row.title).toBe('Search and automatic Chat context exclude this file.');
  });

  it('announces a preparation state that needs the user, unless the row is restricted', () => {
    const marker = { kind: 'failed' as const, title: 'File preparation failed.' };
    const { view } = renderRow(rowFor('deep/nested/paper.pdf'), { marker });

    const marked = screen.getByRole('treeitem', { name: 'paper.pdf, File preparation failed.' });
    expect(marked.title).toBe('File preparation failed.');

    view.unmount();
    renderRow(rowFor('linked-file'), { marker });
    expect(
      screen.getByRole('treeitem', { name: 'linked-file, restricted, Show in file manager' }),
    ).not.toBeNull();
  });
});

describe('file tree row gestures', () => {
  it('acts on the first click of a double click and leaves the second alone', async () => {
    const row = rowFor('docs');
    const { onActivate } = renderRow(row);

    fireEvent.click(rowElement(), { detail: 1 });
    expect(onActivate).toHaveBeenCalledWith(row);

    fireEvent.click(rowElement(), { detail: 2 });
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('starts a rename from a double click on an editable row and refuses a restricted one', () => {
    const row = rowFor('docs/plan.md');
    const { onRename, view } = renderRow(row);

    expect(fireEvent.doubleClick(rowElement())).toBe(false);
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename.mock.calls[0]?.[0]).toBe(row);
    expect(typeof onRename.mock.calls[0]?.[1]).toBe('number');

    view.unmount();
    const restricted = renderRow(rowFor('vendor'));
    fireEvent.doubleClick(rowElement());
    expect(restricted.onRename).not.toHaveBeenCalled();
  });

  it('reports focus by path and hands each key the row and whether it can be edited', () => {
    const row = rowFor('docs/plan.md');
    const { onFocus, onKeyDown, view } = renderRow(row);

    fireEvent.focus(rowElement());
    expect(onFocus).toHaveBeenCalledWith('docs/plan.md');

    fireEvent.keyDown(rowElement(), { key: 'F2' });
    expect(onKeyDown.mock.calls[0]?.slice(1)).toEqual([row, true]);

    view.unmount();
    const restricted = rowFor('linked-file');
    const other = renderRow(restricted);
    fireEvent.keyDown(rowElement(), { key: 'F2' });
    expect(other.onKeyDown.mock.calls[0]?.slice(1)).toEqual([restricted, false]);
  });

  it('registers its element with the tree and gives it back on unmount', () => {
    const { registerRow, view } = renderRow(rowFor('docs/plan.md'));

    expect(registerRow).toHaveBeenCalledWith('docs/plan.md', rowElement());
    view.unmount();
    expect(registerRow).toHaveBeenLastCalledWith('docs/plan.md', null);
  });
});

describe('file tree row drag source', () => {
  it('carries explicit source identity for a regular file', () => {
    renderRow(rowFor('docs/plan.md'));
    const { data, dataTransfer } = dragTransfer();

    expect(rowElement().getAttribute('draggable')).toBe('true');
    fireEvent.dragStart(rowElement(), { dataTransfer });
    expect(JSON.parse(data.get(SOURCE_DRAG_MIME) ?? 'null')).toEqual({
      folderPath: RESEARCH_FOLDER.path,
      path: 'docs/plan.md',
    });
  });

  it('refuses to start a drag from a folder, a generic file, or a restricted entry', () => {
    for (const path of ['docs', 'archive.zip', 'linked-file']) {
      const { view } = renderRow(rowFor(path));
      const { data, dataTransfer } = dragTransfer();

      expect(rowElement().getAttribute('draggable')).toBe('false');
      expect(fireEvent.dragStart(rowElement(), { dataTransfer })).toBe(false);
      expect(data.size).toBe(0);
      view.unmount();
    }
  });
});
