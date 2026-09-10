import { describe, expect, it } from 'vite-plus/test';

import {
  analyzeJsonSource,
  formatJsonPath,
  type JsonSourceNode,
} from '@/features/documents/domain/json-source';

import { jsonTreeKeyCommand, type JsonTreeKeyContext } from './tree-keyboard';
import { visibleJsonNodes, type VisibleJsonNode } from './tree-model';

const SOURCE = '{"one":{"deep":1},"two":"text"}';
const EXPANDED = new Set(['$', '$.one']);

function grid(): VisibleJsonNode[] {
  const analysis = analyzeJsonSource(SOURCE);
  if (!analysis.available) throw new Error(analysis.message);
  return [...visibleJsonNodes(analysis.root, EXPANDED)];
}

function rowAt(visible: VisibleJsonNode[], path: string): VisibleJsonNode {
  const item = visible.find((candidate) => formatJsonPath(candidate.node.path) === path);
  if (!item) throw new Error(`No visible row at ${path}.`);
  return item;
}

function context(path: string, editable = true): JsonTreeKeyContext {
  const visible = grid();
  return { editable, expanded: EXPANDED, item: rowAt(visible, path), visible };
}

function selectedPath(command: ReturnType<typeof jsonTreeKeyCommand>): string | null {
  if (!command || command.command.kind !== 'select') return null;
  return formatJsonPath(command.command.node.path);
}

function nodeOf(command: ReturnType<typeof jsonTreeKeyCommand>): JsonSourceNode | null {
  if (!command) return null;
  const inner = command.command;
  return inner.kind === 'toggle' || inner.kind === 'delete' ? inner.node : null;
}

describe('JSON tree keyboard', () => {
  it('walks the visible rows and clamps at both ends', () => {
    expect(selectedPath(jsonTreeKeyCommand('ArrowDown', context('$')))).toBe('$.one');
    expect(selectedPath(jsonTreeKeyCommand('ArrowUp', context('$.one')))).toBe('$');
    expect(selectedPath(jsonTreeKeyCommand('ArrowUp', context('$')))).toBe('$');
    expect(selectedPath(jsonTreeKeyCommand('End', context('$')))).toBe('$.two');
    expect(selectedPath(jsonTreeKeyCommand('Home', context('$.two')))).toBe('$');
  });

  it('expands a collapsed container and steps into an expanded one', () => {
    const collapsed = jsonTreeKeyCommand('ArrowRight', {
      ...context('$.one'),
      expanded: new Set(['$']),
    });
    expect(collapsed?.command.kind).toBe('toggle');
    expect(formatJsonPath(nodeOf(collapsed)?.path ?? [])).toBe('$.one');

    expect(selectedPath(jsonTreeKeyCommand('ArrowRight', context('$.one')))).toBe('$.one.deep');
  });

  it('collapses an expanded container and otherwise walks to the parent', () => {
    expect(jsonTreeKeyCommand('ArrowLeft', context('$.one'))?.command.kind).toBe('toggle');
    expect(selectedPath(jsonTreeKeyCommand('ArrowLeft', context('$.one.deep')))).toBe('$.one');
  });

  it('leaves ArrowRight on a leaf to the browser', () => {
    expect(jsonTreeKeyCommand('ArrowRight', context('$.two'))).toBeNull();
    expect(jsonTreeKeyCommand('a', context('$.two'))).toBeNull();
  });

  it('opens value and key editors without swallowing the keystroke', () => {
    const replace = jsonTreeKeyCommand('Enter', context('$.two'));
    expect(replace?.preventDefault).toBe(false);
    expect(replace?.command).toMatchObject({ intent: { kind: 'replace' }, kind: 'edit' });

    const rename = jsonTreeKeyCommand('F2', context('$.two'));
    expect(rename?.preventDefault).toBe(false);
    expect(rename?.command).toMatchObject({ intent: { kind: 'rename' }, kind: 'edit' });
  });

  it('never edits a container, the root, or a read-only document', () => {
    expect(jsonTreeKeyCommand('Enter', context('$.one'))).toBeNull();
    expect(jsonTreeKeyCommand('F2', context('$'))).toBeNull();
    expect(jsonTreeKeyCommand('Delete', context('$'))).toBeNull();
    expect(jsonTreeKeyCommand('Enter', context('$.two', false))).toBeNull();
    expect(jsonTreeKeyCommand('F2', context('$.two', false))).toBeNull();
    expect(jsonTreeKeyCommand('Delete', context('$.two', false))).toBeNull();
  });

  it('consumes Delete so the grid removes the row instead of the browser', () => {
    const command = jsonTreeKeyCommand('Delete', context('$.two'));
    expect(command?.preventDefault).toBe(true);
    expect(formatJsonPath(nodeOf(command)?.path ?? [])).toBe('$.two');
  });
});
