/**
 * Bounded, strict analysis of a JSON document's source text.
 *
 * The parse is offset-preserving: every node keeps the exact slice it came
 * from, so the outline can describe a file without ever reformatting it, and
 * an edit is a splice into the original bytes. Anything past the limits below
 * refuses the tree rather than freezing the surface.
 */
import { parseTree, printParseErrorCode, type Node, type ParseError } from 'jsonc-parser';

export const JSON_TREE_LIMITS = Object.freeze({ bytes: 512_000, depth: 80, nodes: 20_000 });

export type JsonPath = Array<number | string>;

export interface JsonSourceNode {
  children: JsonSourceNode[];
  key?: string;
  length: number;
  offset: number;
  path: JsonPath;
  raw: string;
  type: Node['type'];
  valueLength: number;
  valueOffset: number;
}

export type JsonTreeAnalysis =
  | { available: true; maxDepth: number; nodeCount: number; root: JsonSourceNode }
  | {
      available: false;
      location?: { column: number; line: number };
      message: string;
      reason: 'duplicate-keys' | 'empty' | 'invalid' | 'over-limit';
    };

/** Strict, bounded analysis. Source text remains authoritative at every stage. */
export function analyzeJsonSource(source: string): JsonTreeAnalysis {
  const byteLength = new TextEncoder().encode(source).length;
  if (byteLength > JSON_TREE_LIMITS.bytes) {
    return unavailable(
      'over-limit',
      `Tree mode supports JSON up to ${formatBytes(JSON_TREE_LIMITS.bytes)}; this file is ${formatBytes(byteLength)}. Use Source mode.`,
    );
  }
  const bom = source.startsWith('\uFEFF') ? 1 : 0;
  const text = source.slice(bom);
  if (!text.trim())
    return unavailable('empty', 'Tree mode needs a JSON value. Add one in Source mode.');
  const errors: ParseError[] = [];
  const parsed = parseTree(text, errors, {
    allowEmptyContent: false,
    allowTrailingComma: false,
    disallowComments: true,
  });
  if (!parsed || errors.length) {
    const error = errors[0];
    const offset = bom + (error?.offset ?? 0);
    const location = sourceLocation(source, offset);
    const detail = error
      ? humanizeError(printParseErrorCode(error.error))
      : 'Expected a JSON value';
    return unavailable(
      'invalid',
      `${detail} at line ${location.line}, column ${location.column}. Fix it in Source mode.`,
      location,
    );
  }

  let duplicatePath: string | null = null;
  let exceededStructureLimit = false;
  let maxDepth = 0;
  let nodeCount = 0;
  const visit = (node: Node, path: JsonPath, depth: number, key?: string): JsonSourceNode => {
    nodeCount += 1;
    maxDepth = Math.max(maxDepth, depth);
    const offset = node.offset + bom;
    const children: JsonSourceNode[] = [];
    if (nodeCount > JSON_TREE_LIMITS.nodes || depth > JSON_TREE_LIMITS.depth) {
      exceededStructureLimit = true;
    } else if (node.type === 'object') {
      const seen = new Set<string>();
      for (const property of node.children ?? []) {
        const keyNode = property.children?.[0];
        const valueNode = property.children?.[1];
        if (!keyNode || !valueNode) continue;
        const propertyKey = String(keyNode.value);
        if (seen.has(propertyKey) && duplicatePath === null) {
          duplicatePath = formatJsonPath([...path, propertyKey]);
        }
        seen.add(propertyKey);
        children.push(visit(valueNode, [...path, propertyKey], depth + 1, propertyKey));
      }
    } else if (node.type === 'array') {
      for (const [index, child] of (node.children ?? []).entries()) {
        children.push(visit(child, [...path, index], depth + 1));
      }
    }
    return {
      children,
      ...(key === undefined ? {} : { key }),
      length: node.length,
      offset,
      path,
      raw: source.slice(offset, offset + node.length),
      type: node.type,
      valueLength: node.length,
      valueOffset: offset,
    };
  };
  const root = visit(parsed, [], 0);
  if (duplicatePath) {
    return unavailable(
      'duplicate-keys',
      `Tree mode is unavailable because ${duplicatePath} is duplicated. Use Source mode to preserve both properties.`,
    );
  }
  if (
    exceededStructureLimit ||
    nodeCount > JSON_TREE_LIMITS.nodes ||
    maxDepth > JSON_TREE_LIMITS.depth
  ) {
    return unavailable(
      'over-limit',
      `Tree mode supports at most ${JSON_TREE_LIMITS.nodes.toLocaleString()} nodes and depth ${JSON_TREE_LIMITS.depth}; this document has ${nodeCount.toLocaleString()} nodes and depth ${maxDepth}. Use Source mode.`,
    );
  }
  return { available: true, maxDepth, nodeCount, root };
}

export function formatJsonPath(path: JsonPath): string {
  if (!path.length) return '$';
  return (
    '$' +
    path
      .map((part) =>
        typeof part === 'number'
          ? `[${part}]`
          : /^[A-Za-z_$][\w$]*$/u.test(part)
            ? `.${part}`
            : `[${JSON.stringify(part)}]`,
      )
      .join('')
  );
}

function sourceLocation(source: string, offset: number) {
  const before = source.slice(0, offset);
  const lineStart = Math.max(before.lastIndexOf('\n'), before.lastIndexOf('\r'));
  return { column: offset - lineStart, line: before.split(/\r\n|\r|\n/u).length };
}

function unavailable(
  reason: 'duplicate-keys' | 'empty' | 'invalid' | 'over-limit',
  message: string,
  location?: { column: number; line: number },
): JsonTreeAnalysis {
  return { available: false, ...(location === undefined ? {} : { location }), message, reason };
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(bytes >= 1_000_000 ? 0 : 1)} MB`;
}

function humanizeError(code: string): string {
  return code.replace(/([a-z])([A-Z])/gu, '$1 $2').replace(/^./u, (letter) => letter.toUpperCase());
}
