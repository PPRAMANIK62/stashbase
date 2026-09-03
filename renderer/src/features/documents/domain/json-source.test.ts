import { describe, expect, it } from 'vite-plus/test';

import {
  JSON_TREE_LIMITS,
  addJsonChild,
  analyzeJsonSource,
  deleteJsonPath,
  matchingJsonTreeNodes,
  renameJsonProperty,
  reorderJsonArrayItem,
  replaceJsonNode,
} from './json-source';

describe('JSON source model', () => {
  it('rejects malformed, empty, commented, trailing-comma, and duplicate-key trees truthfully', () => {
    for (const [source, reason] of [
      ['', 'empty'],
      ['{"a":', 'invalid'],
      ['// no\n{"a":1}', 'invalid'],
      ['{"a":1,}', 'invalid'],
      ['{"a":1,"a":2}', 'duplicate-keys'],
    ] as const) {
      const result = analyzeJsonSource(source);
      expect(result.available, source).toBe(false);
      if (!result.available) {
        expect(result.reason).toBe(reason);
        expect(result.message).toContain('Source mode');
        if (reason === 'invalid') expect(result.location).toBeDefined();
      }
    }
  });

  it('retains source lexemes without numeric coercion', () => {
    const source =
      '\uFEFF{\r\n  "large": 900719925474099312345,\r\n  "exponent": 1.2300e+42,\r\n  "escaped": "\\u0061\\/b"\r\n}\r\n';
    const result = analyzeJsonSource(source);

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.root.children[0].raw).toBe('900719925474099312345');
    expect(result.root.children[1].raw).toBe('1.2300e+42');
    expect(result.root.children[2].raw).toBe('"\\u0061\\/b"');
  });

  it('shares case and whole-word matching semantics with document Find', () => {
    const result = analyzeJsonSource('{"Alpha":"alpha_beta","other":"alpha"}');
    expect(result.available).toBe(true);
    if (!result.available) return;

    expect(
      matchingJsonTreeNodes(result.root, 'Alpha', {
        caseSensitive: true,
        wholeWord: true,
      }).map((node) => node.path),
    ).toEqual([['Alpha']]);
    expect(
      matchingJsonTreeNodes(result.root, 'alpha', {
        caseSensitive: true,
        wholeWord: true,
      }).map((node) => node.path),
    ).toEqual([['other']]);
    expect(
      matchingJsonTreeNodes(result.root, 'alpha', {
        caseSensitive: false,
        wholeWord: false,
      }).map((node) => node.path),
    ).toEqual([['Alpha'], ['other']]);
  });

  it('patches only the safe source range for structural edits', () => {
    const original =
      '\uFEFF{\r\n  "untouched" : "\\u0061\\/b",\r\n  "large": 900719925474099312345,\r\n  "nested": { "value": true },\r\n  "items": [1, 2, 3]\r\n}\r\n';
    const analysis = analyzeJsonSource(original);
    expect(analysis.available).toBe(true);
    if (!analysis.available) return;

    const value = analysis.root.children[2].children[0];
    let source = replaceJsonNode(original, value, 'false');
    expect(source.replace('false', 'true')).toBe(original);
    source = renameJsonProperty(source, ['nested', 'value'], 'enabled');
    expect(source).toContain('"nested": { "enabled": false }');
    source = addJsonChild(source, ['nested'], '900719925474099399999', 'precise');
    expect(source).toContain('"precise": 900719925474099399999');
    source = addJsonChild(source, ['items'], '{"raw":1.00e+2}');
    expect(source).toContain('[1, 2, 3, {"raw":1.00e+2}]');
    source = reorderJsonArrayItem(source, ['items'], 0, 2);
    expect(source).toContain('[2, 3, 1, {"raw":1.00e+2}]');
    source = deleteJsonPath(source, ['nested', 'enabled']);
    expect(source).not.toContain('enabled');
    expect(source.startsWith('\uFEFF')).toBe(true);
    expect(source.endsWith('\r\n')).toBe(true);
    expect(source).toContain('"untouched" : "\\u0061\\/b"');
    expect(source).toContain('900719925474099312345');
    expect(analyzeJsonSource(source).available).toBe(true);
  });

  it('adds the first member without introducing a blank line', () => {
    const cases: Array<[string, string, string | undefined, string]> = [
      ['{\n}', '1', 'a', '{\n  "a": 1\n}'],
      ['[\n]', '1', undefined, '[\n  1\n]'],
      ['{\n  }', '1', 'a', '{\n    "a": 1\n  }'],
      ['[\n  ]', '1', undefined, '[\n    1\n  ]'],
      ['{\r\n}', '1', 'a', '{\r\n  "a": 1\r\n}'],
    ];
    for (const [source, value, key, expected] of cases) {
      expect(addJsonChild(source, [], value, key), source).toBe(expected);
    }
  });

  it('validates subtree replacements before touching the source', () => {
    const source = '{"node":{"a":1},"keep" : 2}';
    const analysis = analyzeJsonSource(source);
    expect(analysis.available).toBe(true);
    if (!analysis.available) return;

    expect(() => replaceJsonNode(source, analysis.root.children[0], '{"bad":}', true)).toThrow(
      /not valid strict JSON/u,
    );
    expect(replaceJsonNode(source, analysis.root.children[0], '{\n  "fresh": 3\n}', true)).toBe(
      '{"node":{\n  "fresh": 3\n},"keep" : 2}',
    );
  });

  it('bounds tree analysis by bytes, nodes, and depth', () => {
    const bytes = analyzeJsonSource(`"${'x'.repeat(JSON_TREE_LIMITS.bytes)}"`);
    expect(bytes.available).toBe(false);
    if (!bytes.available) expect(bytes.reason).toBe('over-limit');

    const deeplyNested = `${'['.repeat(JSON_TREE_LIMITS.depth + 1)}0${']'.repeat(JSON_TREE_LIMITS.depth + 1)}`;
    const depth = analyzeJsonSource(deeplyNested);
    expect(depth.available).toBe(false);
    if (!depth.available) expect(depth.reason).toBe('over-limit');
  });
});
