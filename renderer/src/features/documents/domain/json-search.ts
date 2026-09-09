/** Matching nodes in a parsed JSON outline: the Find controller's index. */
import { formatJsonPath, type JsonSourceNode } from './json-source';

export interface JsonTreeSearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
}

export function matchingJsonTreeNodes(
  root: JsonSourceNode,
  query: string,
  options: JsonTreeSearchOptions,
): JsonSourceNode[] {
  if (!query) return [];
  return flattenNodes(root).filter((node) => textContains(treeSearchText(node), query, options));
}

function flattenNodes(root: JsonSourceNode): JsonSourceNode[] {
  return [root, ...root.children.flatMap(flattenNodes)];
}

function treeSearchText(node: JsonSourceNode): string {
  return `${node.key ?? ''}\n${node.type === 'object' || node.type === 'array' ? '' : node.raw}\n${formatJsonPath(node.path)}`;
}

function textContains(text: string, query: string, options: JsonTreeSearchOptions): boolean {
  const haystack = options.caseSensitive ? text : text.toLowerCase();
  const needle = options.caseSensitive ? query : query.toLowerCase();
  for (
    let from = haystack.indexOf(needle);
    from >= 0;
    from = haystack.indexOf(needle, from + Math.max(1, needle.length))
  ) {
    const to = from + needle.length;
    if (!options.wholeWord || (isWordBoundary(text, from - 1) && isWordBoundary(text, to))) {
      return true;
    }
  }
  return false;
}

function isWordBoundary(text: string, index: number): boolean {
  const character = text[index];
  return character === undefined || !/[\p{L}\p{N}_]/u.test(character);
}
