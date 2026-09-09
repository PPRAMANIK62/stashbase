import { describe, expect, it } from 'vite-plus/test';

import {
  analyzeJsonSource,
  formatJsonPath,
  type JsonSourceNode,
} from '@/features/documents/domain/json-source';

import {
  isJsonContainer,
  jsonNodeDisplayValue,
  jsonNodeEditableValue,
  jsonNodeLabel,
  jsonNodeSourceValue,
  jsonTableValueSource,
  lastVisibleDescendantIndex,
  visibleJsonNodes,
} from './tree-model';

function rootOf(source: string): JsonSourceNode {
  const analysis = analyzeJsonSource(source);
  if (!analysis.available) throw new Error(analysis.message);
  return analysis.root;
}

const NESTED = '{"one":{"deep":[1,2]},"two":"text"}';

describe('JSON tree projection', () => {
  it('shows only the children of expanded containers, in document order', () => {
    const root = rootOf(NESTED);
    expect(visibleJsonNodes(root, new Set()).map(({ node }) => formatJsonPath(node.path))).toEqual([
      '$',
    ]);

    const paths = visibleJsonNodes(root, new Set(['$', '$.one'])).map(({ node }) =>
      formatJsonPath(node.path),
    );
    expect(paths).toEqual(['$', '$.one', '$.one.deep', '$.two']);
  });

  it('reports each row position within its own container for the treegrid', () => {
    const visible = visibleJsonNodes(rootOf(NESTED), new Set(['$', '$.one', '$.one.deep']));
    const deepItems = visible.filter(
      ({ node }) => node.path[0] === 'one' && node.path.length === 3,
    );
    expect(deepItems.map((item) => [item.position, item.setSize])).toEqual([
      [1, 2],
      [2, 2],
    ]);
    expect(deepItems[0]?.parent?.type).toBe('array');
  });

  it('places a new child after the whole expanded subtree of its container', () => {
    const visible = visibleJsonNodes(rootOf(NESTED), new Set(['$', '$.one', '$.one.deep']));
    expect(lastVisibleDescendantIndex(visible, ['one'])).toBe(4);
    expect(lastVisibleDescendantIndex(visible, [])).toBe(visible.length - 1);
    expect(lastVisibleDescendantIndex(visible, ['missing'])).toBe(-1);
  });

  it('labels rows by key, array index, or root', () => {
    const visible = visibleJsonNodes(rootOf(NESTED), new Set(['$', '$.one', '$.one.deep']));
    expect(visible.map(({ node }) => jsonNodeLabel(node))).toEqual([
      'Root',
      'one',
      'deep',
      '[0]',
      '[1]',
      'two',
    ]);
  });

  it('summarizes containers and shows scalars as their editable text', () => {
    const root = rootOf(NESTED);
    expect(jsonNodeDisplayValue(root)).toBe('2 properties');
    expect(jsonNodeDisplayValue(root.children[0]?.children[0] as JsonSourceNode)).toBe('2 items');
    expect(isJsonContainer(root)).toBe(true);

    const text = root.children[1] as JsonSourceNode;
    expect(isJsonContainer(text)).toBe(false);
    expect(jsonNodeEditableValue(text)).toBe('text');
    expect(jsonNodeDisplayValue(text)).toBe('text');
    expect(jsonNodeSourceValue(text, 'other')).toBe('"other"');
  });

  it('keeps a number cell literal and does not quote it', () => {
    const number = rootOf('{"count":42}').children[0] as JsonSourceNode;
    expect(jsonNodeEditableValue(number)).toBe('42');
    expect(jsonNodeSourceValue(number, '43')).toBe('43');
  });

  it('treats typed prose as a JSON string and refuses broken JSON syntax', () => {
    expect(jsonTableValueSource('purbayan.me')).toBe('"purbayan.me"');
    expect(jsonTableValueSource('  true ')).toBe('true');
    expect(jsonTableValueSource('[1, 2]')).toBe('[1, 2]');
    expect(() => jsonTableValueSource('{bad')).toThrow(/Invalid JSON value/u);
    // The reader is in the grid, not the source pane, so the advice is dropped.
    expect(() => jsonTableValueSource('{bad')).not.toThrow(/Source mode/u);
  });
});
