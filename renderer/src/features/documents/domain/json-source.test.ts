import { describe, expect, it } from 'vite-plus/test';

import {
  JSON_TREE_LIMITS,
  analyzeJsonSource,
  type JsonSourceNode,
  type JsonTreeAnalysis,
} from './json-source';

type JsonTreeRejection = Extract<JsonTreeAnalysis, { available: false }>;

function childAt(node: JsonSourceNode, index: number): JsonSourceNode {
  const child = node.children[index];
  if (!child) throw new Error(`Expected a child at index ${index}.`);
  return child;
}

function rejectionOf(analysis: JsonTreeAnalysis, label: string): JsonTreeRejection {
  if (analysis.available) throw new Error(`Expected ${label} to be refused.`);
  return analysis;
}

describe('JSON source analysis', () => {
  it('rejects malformed, empty, commented, trailing-comma, and duplicate-key trees truthfully', () => {
    for (const [source, reason, located] of [
      ['', 'empty', false],
      ['{"a":', 'invalid', true],
      ['// no\n{"a":1}', 'invalid', true],
      ['{"a":1,}', 'invalid', true],
      ['{"a":1,"a":2}', 'duplicate-keys', false],
    ] as const) {
      const result = analyzeJsonSource(source);
      expect(result.available, source).toBe(false);
      const rejection = rejectionOf(result, source);
      expect(rejection.reason, source).toBe(reason);
      expect(rejection.message, source).toContain('Source mode');
      expect(rejection.location !== undefined, source).toBe(located);
    }
  });

  it('retains source lexemes without numeric coercion', () => {
    const source =
      '\uFEFF{\r\n  "large": 900719925474099312345,\r\n  "exponent": 1.2300e+42,\r\n  "escaped": "\\u0061\\/b"\r\n}\r\n';
    const result = analyzeJsonSource(source);

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(childAt(result.root, 0).raw).toBe('900719925474099312345');
    expect(childAt(result.root, 1).raw).toBe('1.2300e+42');
    expect(childAt(result.root, 2).raw).toBe('"\\u0061\\/b"');
  });

  it('bounds tree analysis by bytes, nodes, and depth', () => {
    const bytes = analyzeJsonSource(`"${'x'.repeat(JSON_TREE_LIMITS.bytes)}"`);
    expect(bytes.available).toBe(false);
    expect(rejectionOf(bytes, 'an over-sized document').reason).toBe('over-limit');

    const deeplyNested = `${'['.repeat(JSON_TREE_LIMITS.depth + 1)}0${']'.repeat(JSON_TREE_LIMITS.depth + 1)}`;
    const depth = analyzeJsonSource(deeplyNested);
    expect(depth.available).toBe(false);
    expect(rejectionOf(depth, 'an over-nested document').reason).toBe('over-limit');
  });
});
