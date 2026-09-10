/**
 * What the JSON grid shows, derived from the parsed outline.
 *
 * The projection is pure: which rows are visible for a set of expanded paths,
 * what a row's label, display value, and editable value are, and how a typed
 * cell becomes JSON source. Rendering and keyboard handling live beside it.
 */
import { JsonEditError } from '@/features/documents/domain/json-edit';
import {
  analyzeJsonSource,
  formatJsonPath,
  type JsonSourceNode,
} from '@/features/documents/domain/json-source';

/** An edit the grid has opened on one node. */
export type JsonEditIntent =
  | { kind: 'add'; node: JsonSourceNode }
  | { kind: 'rename'; node: JsonSourceNode }
  | { caretOffset?: number; kind: 'replace'; node: JsonSourceNode };

export interface VisibleJsonNode {
  node: JsonSourceNode;
  parent: JsonSourceNode | null;
  position: number;
  setSize: number;
}

/** The root is always visible, so the projection is never empty. */
export type VisibleJsonNodes = [VisibleJsonNode, ...VisibleJsonNode[]];

export function isJsonContainer(node: JsonSourceNode): boolean {
  return node.type === 'array' || node.type === 'object';
}

export function jsonNodeLabel(node: JsonSourceNode): string {
  if (node.key !== undefined) return node.key;
  const index = node.path.at(-1);
  return typeof index === 'number' ? `[${index}]` : 'Root';
}

function containerSummary(node: JsonSourceNode): string {
  const count = node.children.length;
  if (node.type === 'array') return `${count.toLocaleString()} ${count === 1 ? 'item' : 'items'}`;
  return `${count.toLocaleString()} ${count === 1 ? 'property' : 'properties'}`;
}

export function jsonNodeDisplayValue(node: JsonSourceNode): string {
  if (isJsonContainer(node)) return containerSummary(node);
  return jsonNodeEditableValue(node);
}

/** A string is edited as its text, everything else as its literal source. */
export function jsonNodeEditableValue(node: JsonSourceNode): string {
  if (node.type !== 'string') return node.raw;
  const value: unknown = JSON.parse(node.raw);
  return typeof value === 'string' ? value : node.raw;
}

export function jsonNodeSourceValue(node: JsonSourceNode, value: string): string {
  return node.type === 'string' ? JSON.stringify(value) : value;
}

function looksLikeJsonSyntax(value: string): boolean {
  if (value.startsWith('[') || value.startsWith('{') || value.startsWith('"')) return true;
  if (/^(?:true|false|null)$/u.test(value)) return true;
  return /^(?:-?(?:\d|\.)|NaN$|Infinity$|-Infinity$)/u.test(value);
}

/** Plain prose typed into a new cell becomes a JSON string; anything that
 *  reads as JSON syntax must actually parse, and says so when it does not. */
export function jsonTableValueSource(value: string): string {
  const trimmed = value.trim();
  if (!looksLikeJsonSyntax(trimmed)) return JSON.stringify(value);

  const analysis = analyzeJsonSource(trimmed);
  if (!analysis.available) {
    const detail = analysis.message.replace(/\s*Fix it in Source mode\.?$/u, '');
    throw new JsonEditError('rejected', `Invalid JSON value: ${detail}`);
  }
  return trimmed;
}

/** The last row belonging to `parentPath`, so a new child is inserted after
 *  the whole expanded subtree rather than immediately under its container. */
export function lastVisibleDescendantIndex(
  visible: readonly VisibleJsonNode[],
  parentPath: JsonSourceNode['path'],
): number {
  for (let index = visible.length - 1; index >= 0; index -= 1) {
    const path = visible[index]?.node.path;
    if (path && parentPath.every((part, pathIndex) => path[pathIndex] === part)) return index;
  }
  return -1;
}

export function visibleJsonNodes(
  root: JsonSourceNode,
  expanded: ReadonlySet<string>,
): VisibleJsonNodes {
  const rootItem: VisibleJsonNode = { node: root, parent: null, position: 1, setSize: 1 };
  const result: VisibleJsonNodes = [rootItem];
  const visit = (item: VisibleJsonNode) => {
    if (!isJsonContainer(item.node) || !expanded.has(formatJsonPath(item.node.path))) return;
    item.node.children.forEach((child, index) => {
      const next: VisibleJsonNode = {
        node: child,
        parent: item.node,
        position: index + 1,
        setSize: item.node.children.length,
      };
      result.push(next);
      visit(next);
    });
  };
  visit(rootItem);
  return result;
}
