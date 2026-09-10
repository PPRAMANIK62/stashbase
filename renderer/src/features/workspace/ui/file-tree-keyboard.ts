import { nextTreePath, type TreeRow } from '@/features/workspace/domain/tree';

/** What a key press on a row means. `consume` is a key the tree owns but that
 *  has nothing to do in this state — a restricted folder cannot open — and
 *  `none` is a key the tree does not own at all, left to the browser. */
export type TreeKeyIntent =
  | { kind: 'activate' }
  | { kind: 'consume' }
  | { kind: 'delete' }
  | { kind: 'focus'; path: string | null }
  | { kind: 'none' }
  | { kind: 'rename' }
  | { kind: 'toggle' };

export interface TreeKeyContext {
  /** True while this row's folder is open. */
  expanded: boolean;
  /** The rows on screen, which is what a linear move walks. */
  renderedRows: readonly TreeRow[];
  /** True for an entry the window may only reveal, never edit. */
  restricted: boolean;
  /** Every row in the tree model, for the parent and first-child moves. */
  rows: readonly TreeRow[];
}

/**
 * The whole keyboard contract of the tree, as a pure function: linear moves
 * first, then activation, then the two editing keys, then the horizontal moves
 * that open, close, or step out of a folder. Keeping it out of the component
 * means the contract can be read and tested without a DOM.
 */
export function treeKeyIntent(key: string, row: TreeRow, context: TreeKeyContext): TreeKeyIntent {
  const nextPath = nextTreePath(key, row.node.path, context.renderedRows);
  if (nextPath !== null) return { kind: 'focus', path: nextPath };
  if (key === 'Enter' || key === ' ') return { kind: 'activate' };
  if (key === 'F2' && !context.restricted) return { kind: 'rename' };
  if (key === 'Delete' && !context.restricted) return { kind: 'delete' };

  if (key === 'ArrowRight' && row.node.type === 'folder') {
    if (context.restricted) return { kind: 'consume' };
    if (!context.expanded) return { kind: 'toggle' };
    const firstChild = context.rows.find((candidate) => candidate.parentPath === row.node.path);
    return { kind: 'focus', path: firstChild?.node.path ?? null };
  }

  if (key === 'ArrowLeft') {
    if (row.node.type === 'folder' && !context.restricted && context.expanded) {
      return { kind: 'toggle' };
    }
    return { kind: 'focus', path: row.parentPath };
  }

  return { kind: 'none' };
}
