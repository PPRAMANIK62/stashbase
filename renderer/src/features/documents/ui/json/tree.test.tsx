import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { JsonDocumentSession } from '@/features/documents/domain/document';
import { pressKey } from '@/test/dom';

import { JsonTree } from './tree';

afterEach(cleanup);

const BASE_SESSION: JsonDocumentSession = {
  expandedPaths: ['$'],
  search: '',
  searchOptions: { caseSensitive: false, wholeWord: false },
  selectedPath: '$',
  viewMode: 'tree',
};

/** The grid is fully controlled, so the test owns the session and the text. */
function Harness({
  editable = true,
  initial,
  onChange,
  session: sessionOverrides,
}: {
  editable?: boolean;
  initial: string;
  onChange?: (value: string) => void;
  session?: Partial<JsonDocumentSession>;
}) {
  const [source, setSource] = useState(initial);
  const [session, setSession] = useState<JsonDocumentSession>({
    ...BASE_SESSION,
    ...sessionOverrides,
  });
  return (
    <JsonTree
      active
      editable={editable}
      onActivate={() => undefined}
      onChange={(next) => {
        onChange?.(next);
        setSource(next);
      }}
      onSessionChange={(patch) => setSession((current) => ({ ...current, ...patch }))}
      session={session}
      source={source}
    />
  );
}

function rowNames(): string[] {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent?.trim() ?? '');
}

describe('JSON tree grid', () => {
  it('explains an unusable document instead of showing an empty grid', () => {
    render(<Harness initial='{"unfinished":' />);

    expect(screen.getByRole('status').textContent).toContain('Source mode');
    expect(screen.queryByRole('treegrid')).toBeNull();
  });

  it('renders a row per visible node with its type and container summary', () => {
    render(<Harness initial='{"title":"Plan","items":[1,2]}' />);

    expect(rowNames()).toEqual(['Root', 'title', 'items']);
    const itemsRow = screen.getByRole('row', { name: /^items/u });
    expect(itemsRow.textContent).toContain('2 items');
    expect(itemsRow.getAttribute('aria-expanded')).toBe('false');
  });

  it('expands a container from its disclosure button', () => {
    render(<Harness initial='{"items":[1,2]}' />);

    fireEvent.click(screen.getByRole('button', { name: 'Expand $.items' }));
    expect(rowNames()).toEqual(['Root', 'items', '[0]', '[1]']);
    expect(screen.getByRole('button', { name: 'Collapse $.items' })).not.toBeNull();
  });

  it('walks rows with the arrow keys and selects the row it lands on', () => {
    render(<Harness initial='{"title":"Plan","items":[1,2]}' />);

    const root = screen.getByRole('row', { name: /^Root/u });
    pressKey(root, 'ArrowDown');
    expect(screen.getByRole('row', { name: /^title/u }).getAttribute('aria-selected')).toBe('true');

    pressKey(screen.getByRole('row', { name: /^title/u }), 'End');
    expect(screen.getByRole('row', { name: /^items/u }).getAttribute('aria-selected')).toBe('true');
  });

  it('edits a scalar in place and reports the patched source', () => {
    const onChange = vi.fn();
    render(<Harness initial='{"title":"Plan"}' onChange={onChange} />);

    const titleRow = screen.getByRole('row', { name: /^title/u });
    fireEvent.click(titleRow);
    pressKey(screen.getByRole('row', { name: /^title/u }), 'Enter');

    const field = screen.getByLabelText('JSON value');
    expect((field as HTMLInputElement).value).toBe('Plan');
    fireEvent.change(field, { target: { value: 'Revised' } });
    pressKey(field, 'Enter');

    expect(onChange).toHaveBeenCalledWith('{"title":"Revised"}');
    expect(screen.queryByLabelText('JSON value')).toBeNull();
  });

  it('renames a property with F2 and keeps the value untouched', () => {
    const onChange = vi.fn();
    render(<Harness initial='{"title":"Plan"}' onChange={onChange} />);

    fireEvent.click(screen.getByRole('row', { name: /^title/u }));
    pressKey(screen.getByRole('row', { name: /^title/u }), 'F2');
    const key = screen.getByLabelText('Key');
    fireEvent.change(key, { target: { value: 'heading' } });
    pressKey(key, 'Enter');

    expect(onChange).toHaveBeenCalledWith('{"heading":"Plan"}');
  });

  it('reports a refused edit without losing the document', () => {
    const onChange = vi.fn();
    render(<Harness initial='{"title":"Plan","other":1}' onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add property' }));
    fireEvent.change(screen.getByLabelText('New property key'), { target: { value: 'other' } });
    fireEvent.change(screen.getByLabelText('New JSON value'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add value' }));

    expect(screen.getByRole('alert').textContent).toContain('already exists');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('offers no editing affordances on a read-only document', () => {
    render(<Harness editable={false} initial='{"title":"Plan"}' />);

    expect(screen.queryByRole('button', { name: 'Add property' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete title' })).toBeNull();
    pressKey(screen.getByRole('row', { name: /^title/u }), 'Enter');
    expect(screen.queryByLabelText('JSON value')).toBeNull();
  });
});
