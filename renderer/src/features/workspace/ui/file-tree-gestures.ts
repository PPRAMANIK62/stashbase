/**
 * What a gesture on a tree row means. A click browses a file or toggles a
 * folder, a double click keeps a file's document open, F2 starts a rename,
 * and the keyboard contract resolves through `treeKeyIntent`. The tree hands
 * this its live state and gets back the handlers its rows are wired to.
 */
import type { KeyboardEvent } from 'react';

import type { WorkspaceRuntime } from '@/features/workspace/application/runtime';
import type { ExpandedFolders, TreeRow, WorkspaceEntry } from '@/features/workspace/domain/tree';
import type { TreeOpenOptions } from '@/features/workspace/hooks/use-file-operations';
import type { SourceReference } from '@/shared/domain/source-reference';

import { treeKeyIntent } from './file-tree-keyboard';
import { entryOf, rowIsRestricted } from './file-tree-rows';

/** The tree state and verbs a gesture reaches, named rather than borrowed
 *  from the hooks that produce them. */
interface TreeGestureContext {
  focus(path: string | null): void;
  onOpenSource?: ((source: SourceReference, options?: TreeOpenOptions) => void) | undefined;
  operations: {
    beginRename(entry: WorkspaceEntry): void;
    requestDelete(entry: WorkspaceEntry): void;
  };
  renderedRows: readonly TreeRow[];
  reveal: { reveal(path: string): void };
  runtime: Pick<WorkspaceRuntime, 'scope'>;
  setRenameCaret(offset: number | undefined): void;
  setRovingPath(path: string): void;
  tree: {
    expanded: ExpandedFolders;
    rows: readonly TreeRow[];
    select(path: string): void;
    toggle(path: string): void;
  };
}

export function treeGestures({
  focus,
  onOpenSource,
  operations,
  renderedRows,
  reveal,
  runtime,
  setRenameCaret,
  setRovingPath,
  tree,
}: TreeGestureContext) {
  const sourceOf = (row: TreeRow): SourceReference => ({
    folderPath: runtime.scope.folder.path,
    path: row.node.path,
  });

  /** A click: toggle or reveal a folder, reveal a restricted file, or browse
   *  a file, which opens it as the preview. */
  const activate = (row: TreeRow) => {
    tree.select(row.node.path);
    setRovingPath(row.node.path);
    if (row.node.type === 'folder') {
      if (rowIsRestricted(row)) reveal.reveal(row.node.path);
      else tree.toggle(row.node.path);
    } else if (rowIsRestricted(row)) {
      reveal.reveal(row.node.path);
    } else {
      onOpenSource?.(sourceOf(row));
    }
  };

  /** A double click on a file: its document stays open. */
  const keep = (row: TreeRow) => {
    if (row.node.type !== 'file' || rowIsRestricted(row)) return;
    tree.select(row.node.path);
    setRovingPath(row.node.path);
    onOpenSource?.(sourceOf(row), { keep: true });
  };

  const beginRename = (row: TreeRow, caretOffset?: number) => {
    tree.select(row.node.path);
    setRovingPath(row.node.path);
    setRenameCaret(caretOffset);
    operations.beginRename(entryOf(row));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, row: TreeRow) => {
    const expanded = row.node.type === 'folder' && tree.expanded[row.node.path] === true;
    const intent = treeKeyIntent(event.key, row, {
      expanded,
      renderedRows,
      restricted: rowIsRestricted(row),
      rows: tree.rows,
    });
    if (intent.kind === 'none') return;
    event.preventDefault();
    if (intent.kind === 'focus') focus(intent.path);
    else if (intent.kind === 'activate') activate(row);
    else if (intent.kind === 'rename') beginRename(row);
    else if (intent.kind === 'delete') operations.requestDelete(entryOf(row));
    else if (intent.kind === 'toggle') tree.toggle(row.node.path);
  };

  return { activate, beginRename, keep, onKeyDown };
}
