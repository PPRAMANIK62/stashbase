import { describe, expect, it } from 'vite-plus/test';

import { listNavigationTarget } from './list-navigation';

const cursor = { activeIndex: 2, count: 10, pageSize: 6 };

describe('list navigation', () => {
  it('moves by row, by page, and to the ends without leaving the list', () => {
    expect(listNavigationTarget('ArrowDown', cursor)).toBe(3);
    expect(listNavigationTarget('ArrowUp', cursor)).toBe(1);
    expect(listNavigationTarget('Home', cursor)).toBe(0);
    expect(listNavigationTarget('End', cursor)).toBe(9);
    expect(listNavigationTarget('PageDown', cursor)).toBe(8);
    expect(listNavigationTarget('PageUp', cursor)).toBe(0);
  });

  it('clamps at both boundaries', () => {
    expect(listNavigationTarget('ArrowUp', { ...cursor, activeIndex: 0 })).toBe(0);
    expect(listNavigationTarget('ArrowDown', { ...cursor, activeIndex: 9 })).toBe(9);
    expect(listNavigationTarget('PageDown', { ...cursor, activeIndex: 9 })).toBe(9);
    expect(listNavigationTarget('End', { ...cursor, count: 1 })).toBe(0);
  });

  it('leaves every other key to the caller', () => {
    expect(listNavigationTarget('Enter', cursor)).toBeNull();
    expect(listNavigationTarget('Escape', cursor)).toBeNull();
    expect(listNavigationTarget('a', cursor)).toBeNull();
  });
});
