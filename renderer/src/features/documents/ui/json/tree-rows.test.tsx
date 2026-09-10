import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { Table, TableBody } from '@/components/ui/table';
import { analyzeJsonSource, type JsonSourceNode } from '@/features/documents/domain/json-source';

import { visibleJsonNodes, type VisibleJsonNode } from './tree-model';
import { JsonAddButton, JsonInlineAddRow, JsonInlineEditRow, JsonValueRow } from './tree-rows';

afterEach(cleanup);

const SOURCE = '{"title":"Plan","tags":["draft"],"count":2}';

/** The visible rows of `SOURCE` with every container expanded. */
function nodes(): VisibleJsonNode[] {
  const analysis = analyzeJsonSource(SOURCE);
  if (!analysis.available) throw new Error('fixture is not valid JSON');
  return [...visibleJsonNodes(analysis.root, new Set(['$', '$.tags']))];
}

function nodeAt(label: string): VisibleJsonNode {
  const item = nodes().find((candidate) => candidate.node.key === label);
  if (!item) throw new Error(`no node keyed ${label}`);
  return item;
}

function inTable(row: React.ReactNode) {
  return render(
    <Table>
      <TableBody>{row}</TableBody>
    </Table>,
  );
}

function valueRow(
  item: VisibleJsonNode,
  overrides: Partial<Parameters<typeof JsonValueRow>[0]> = {},
) {
  const props = {
    editable: true,
    isExpanded: false,
    isSelected: false,
    item,
    onDelete: vi.fn(),
    onEdit: vi.fn(),
    onKeyDown: vi.fn(),
    onSelect: vi.fn(),
    onToggle: vi.fn(),
    rowIndex: 0,
    selectedRef: null,
    ...overrides,
  };
  return { ...inTable(<JsonValueRow {...props} />), props };
}

describe('JSON value row', () => {
  it('states its place in the tree so a reader on assistive tech can follow it', () => {
    const { props } = valueRow(nodeAt('title'), { isSelected: true });

    const row = screen.getByRole('row');
    expect(row.getAttribute('aria-level')).toBe('2');
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(row.getAttribute('aria-posinset')).toBe(String(props.item.position));
    expect(row.getAttribute('aria-setsize')).toBe(String(props.item.setSize));
    // Only a deletable row advertises the shortcut that deletes it.
    expect(row.getAttribute('aria-keyshortcuts')).toBe('Delete');
  });

  it('shows the value and its type, and offers deletion by name', () => {
    valueRow(nodeAt('title'));

    expect(screen.getByRole('cell', { name: 'Plan' })).not.toBeNull();
    expect(screen.getByRole('cell', { name: 'string' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Delete title' })).not.toBeNull();
  });

  it('offers expansion for a container and nothing to expand for a leaf', () => {
    valueRow(nodeAt('tags'), { isExpanded: true });
    expect(screen.getByRole('button', { name: 'Collapse $.tags' })).not.toBeNull();

    cleanup();
    valueRow(nodeAt('count'));
    expect(screen.queryByRole('button', { name: /Expand|Collapse/u })).toBeNull();
  });

  it('reports selection, toggling and deletion without deciding any of them', async () => {
    const { props } = valueRow(nodeAt('tags'), { isExpanded: false });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Expand $.tags' }));
    expect(props.onToggle).toHaveBeenCalledWith(props.item.node);
    // Toggling is not a selection: the click never reaches the row.
    expect(props.onSelect).not.toHaveBeenCalled();

    await user.click(screen.getByRole('cell', { name: 'array' }));
    expect(props.onSelect).toHaveBeenCalledWith(props.item.node);

    await user.click(screen.getByRole('button', { name: 'Delete tags' }));
    expect(props.onDelete).toHaveBeenCalledWith(props.item.node);
  });

  it('keeps a read-only row free of every edit affordance', () => {
    valueRow(nodeAt('title'), { editable: false });

    expect(screen.queryByRole('button', { name: 'Delete title' })).toBeNull();
    expect(screen.getByRole('row').getAttribute('aria-keyshortcuts')).toBeNull();
  });
});

describe('JSON inline editors', () => {
  it('edits a value in place and reports the committed source', async () => {
    const item = nodeAt('title');
    const onSubmit = vi.fn();
    inTable(
      <JsonInlineEditRow
        error={null}
        intent={{ kind: 'replace', node: item.node }}
        isExpanded={false}
        item={item}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        onToggle={vi.fn()}
      />,
    );
    const user = userEvent.setup();

    const field = screen.getByRole('textbox', { name: 'JSON value' });
    await user.clear(field);
    await user.type(field, 'Revised{Enter}');

    // A string node's edited text is re-quoted before it reaches the source.
    expect(onSubmit).toHaveBeenCalledWith('title', '"Revised"');
  });

  it('cancels a value edit that did not change anything', async () => {
    const item = nodeAt('title');
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    inTable(
      <JsonInlineEditRow
        error={null}
        intent={{ kind: 'replace', node: item.node }}
        isExpanded={false}
        item={item}
        onCancel={onCancel}
        onSubmit={onSubmit}
        onToggle={vi.fn()}
      />,
    );

    await userEvent.setup().type(screen.getByRole('textbox', { name: 'JSON value' }), '{Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('renames a key and leaves the value showing', async () => {
    const item = nodeAt('title');
    const onSubmit = vi.fn();
    inTable(
      <JsonInlineEditRow
        error={null}
        intent={{ kind: 'rename', node: item.node }}
        isExpanded={false}
        item={item}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        onToggle={vi.fn()}
      />,
    );
    const user = userEvent.setup();

    const field = screen.getByRole('textbox', { name: 'Key' });
    await user.clear(field);
    await user.type(field, 'heading{Enter}');

    // A rename carries the value through untouched; only the key moved.
    expect(onSubmit).toHaveBeenCalledWith('heading', 'Plan');
    expect(screen.getByTitle('"Plan"')).not.toBeNull();
  });

  it('puts a refusal beside the field the reader is editing', () => {
    const item = nodeAt('title');
    inTable(
      <JsonInlineEditRow
        error="That name is already used."
        intent={{ kind: 'rename', node: item.node }}
        isExpanded={false}
        item={item}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert').textContent).toBe('That name is already used.');
  });
});

describe('JSON add row', () => {
  function objectRoot(): JsonSourceNode {
    const analysis = analyzeJsonSource(SOURCE);
    if (!analysis.available) throw new Error('fixture is not valid JSON');
    return analysis.root;
  }

  it('refuses a new property until it has a key', async () => {
    const onSubmit = vi.fn();
    inTable(
      <JsonInlineAddRow error={null} node={objectRoot()} onCancel={vi.fn()} onSubmit={onSubmit} />,
    );
    const user = userEvent.setup();

    expect(screen.getByRole('button', { name: 'Add value' }).hasAttribute('disabled')).toBe(true);

    await user.type(screen.getByRole('textbox', { name: 'New property key' }), 'owner');
    await user.type(screen.getByRole('textbox', { name: 'New JSON value' }), '"me"');
    await user.click(screen.getByRole('button', { name: 'Add value' }));

    expect(onSubmit).toHaveBeenCalledWith('owner', '"me"');
  });

  it('takes an array item without a key at all', async () => {
    const tags = nodeAt('tags').node;
    const onSubmit = vi.fn();
    inTable(<JsonInlineAddRow error={null} node={tags} onCancel={vi.fn()} onSubmit={onSubmit} />);

    expect(screen.queryByRole('textbox', { name: 'New property key' })).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add value' }));

    expect(onSubmit).toHaveBeenCalledWith('', '');
  });

  it('cancels without adding anything', async () => {
    const onCancel = vi.fn();
    inTable(
      <JsonInlineAddRow error={null} node={objectRoot()} onCancel={onCancel} onSubmit={vi.fn()} />,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel add' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('JSON add button', () => {
  it('names what it would add, and refuses when nothing can take a child', async () => {
    const onAdd = vi.fn();
    render(<JsonAddButton onAdd={onAdd} target={null} />);
    expect(screen.getByRole('button', { name: 'Add property' }).hasAttribute('disabled')).toBe(
      true,
    );

    cleanup();
    const tags = nodeAt('tags').node;
    render(<JsonAddButton onAdd={onAdd} target={tags} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add item' }));

    expect(onAdd).toHaveBeenCalledWith(tags);
  });
});
