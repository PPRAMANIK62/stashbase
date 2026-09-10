import { describe, expect, it, vi } from 'vite-plus/test';

import { createFindMatchCursor } from './find-cursor';

const insensitive = { caseSensitive: false, wholeWord: false };

function wordCursor(read: () => string) {
  const revealed: string[] = [];
  const presented: Array<{ active: string | null; total: number }> = [];
  const cursor = createFindMatchCursor<string>({
    collect: (query) =>
      read()
        .split(' ')
        .filter((word) => word.includes(query)),
    present: (matches, active) => presented.push({ active, total: matches.length }),
    reveal: (match) => revealed.push(match),
  });
  return { cursor, presented, revealed };
}

describe('Find match cursor', () => {
  it('lands on the first match and wraps in both directions', () => {
    const { cursor, presented, revealed } = wordCursor(() => 'alpha alpine beta');

    expect(cursor.setQuery('alp', insensitive)).toEqual({ current: 1, total: 2 });
    expect(cursor.next()).toEqual({ current: 2, total: 2 });
    expect(cursor.next()).toEqual({ current: 1, total: 2 });
    expect(cursor.previous()).toEqual({ current: 2, total: 2 });
    expect(revealed).toEqual(['alpha', 'alpine', 'alpha', 'alpine']);
    expect(presented.at(-1)).toEqual({ active: 'alpine', total: 2 });
  });

  it('re-enumerates before a move so an edited-away match is never selected', () => {
    let text = 'alpha alpine beta';
    const { cursor, revealed } = wordCursor(() => text);

    expect(cursor.setQuery('alp', insensitive)).toEqual({ current: 1, total: 2 });
    text = 'beta';
    expect(cursor.next()).toEqual({ current: 0, total: 0 });
    expect(revealed).toEqual(['alpha']);
  });

  it('keeps the reader in place when the surface changes under an open query', () => {
    let text = 'alpha alpine album beta';
    const { cursor, revealed } = wordCursor(() => text);

    cursor.setQuery('al', insensitive);
    cursor.next();
    expect(cursor.next()).toEqual({ current: 3, total: 3 });

    text = 'alpha alpine album';
    cursor.refresh();
    expect(cursor.next()).toEqual({ current: 1, total: 3 });
    expect(revealed.at(-1)).toBe('alpha');
  });

  it('restores a query without pulling the view to the match', () => {
    const { cursor, revealed } = wordCursor(() => 'alpha alpine beta');

    expect(cursor.restoreQuery('alp', insensitive)).toEqual({ current: 0, total: 2 });
    expect(revealed).toEqual([]);
  });

  it('ignores a refresh with no query and clears the presentation on close', () => {
    const collect = vi.fn(() => ['alpha']);
    const cursor = createFindMatchCursor<string>({ collect, reveal: () => undefined });

    cursor.refresh();
    expect(collect).not.toHaveBeenCalled();

    cursor.setQuery('alp', insensitive);
    cursor.close();
    expect(cursor.next()).toEqual({ current: 0, total: 0 });
  });
});
