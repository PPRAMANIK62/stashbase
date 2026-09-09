/**
 * Keyboard navigation for the JSON grid, resolved as pure data.
 *
 * The row handler asks what a key means for the row it fired on and applies
 * the answer, so the treegrid's arrow/Home/End/F2/Delete contract can be read
 * and tested without a DOM.
 */
import { formatJsonPath, type JsonSourceNode } from '@/features/documents/domain/json-source';

import { isJsonContainer, type JsonEditIntent, type VisibleJsonNode } from './tree-model';

type JsonTreeCommand =
  | { kind: 'delete'; node: JsonSourceNode }
  | { kind: 'edit'; intent: JsonEditIntent }
  /** Handled, but nothing moves — the edge of the list. */
  | { kind: 'none' }
  | { kind: 'select'; node: JsonSourceNode }
  | { kind: 'toggle'; node: JsonSourceNode };

export interface JsonTreeKeyResult {
  command: JsonTreeCommand;
  /** Editing keys leave the event alone so the field can take the keystroke. */
  preventDefault: boolean;
}

export interface JsonTreeKeyContext {
  editable: boolean;
  expanded: ReadonlySet<string>;
  item: VisibleJsonNode;
  visible: readonly VisibleJsonNode[];
}

function moved(node: JsonSourceNode | null | undefined): JsonTreeKeyResult {
  return { command: node ? { kind: 'select', node } : { kind: 'none' }, preventDefault: true };
}

/** `null` means the key belongs to the browser, not the grid. */
export function jsonTreeKeyCommand(
  key: string,
  { editable, expanded, item, visible }: JsonTreeKeyContext,
): JsonTreeKeyResult | null {
  const index = visible.indexOf(item);
  const container = isJsonContainer(item.node);
  const path = formatJsonPath(item.node.path);

  if (key === 'ArrowDown') return moved(visible[Math.min(index + 1, visible.length - 1)]?.node);
  if (key === 'ArrowUp') return moved(visible[Math.max(index - 1, 0)]?.node);
  if (key === 'Home') return moved(visible[0]?.node);
  if (key === 'End') return moved(visible.at(-1)?.node);
  if (key === 'ArrowRight' && container) {
    return expanded.has(path)
      ? moved(item.node.children[0])
      : { command: { kind: 'toggle', node: item.node }, preventDefault: true };
  }
  if (key === 'ArrowLeft') {
    return container && expanded.has(path)
      ? { command: { kind: 'toggle', node: item.node }, preventDefault: true }
      : moved(item.parent);
  }
  if (key === 'Enter' && editable && !container) {
    return {
      command: { kind: 'edit', intent: { kind: 'replace', node: item.node } },
      preventDefault: false,
    };
  }
  if (key === 'F2' && editable && item.node.key !== undefined) {
    return {
      command: { kind: 'edit', intent: { kind: 'rename', node: item.node } },
      preventDefault: false,
    };
  }
  if (key === 'Delete' && editable && item.node.path.length > 0) {
    return { command: { kind: 'delete', node: item.node }, preventDefault: true };
  }
  return null;
}
