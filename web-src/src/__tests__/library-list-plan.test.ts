import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LIBRARY_LIST_RECENT_LIMIT,
  libraryListPlan,
  type LibraryListEntry,
} from '../components/libraryListPlan';

function entry(path: string, favorite = false): LibraryListEntry {
  return { path, openedAt: '2026-01-01T00:00:00.000Z', favorite };
}

function names(plan: { visible: LibraryListEntry[] }): string[] {
  return plan.visible.map((e) => e.path);
}

test('favorites all stay visible ahead of the recent window, both in recents order', () => {
  const entries = [
    entry('/a'),
    entry('/fav1', true),
    entry('/b'),
    entry('/fav2', true),
    entry('/c'),
    entry('/d'),
    entry('/e'),
    entry('/f'),
    entry('/fav3', true),
    entry('/g'),
  ];
  const plan = libraryListPlan(entries, '', false);
  assert.deepEqual(names(plan), [
    '/fav1', '/fav2', '/fav3', // every favorite, pinned first, recents order
    '/a', '/b', '/c', '/d', '/e', // then the 5 most recent non-favorites
  ]);
  assert.equal(plan.hiddenCount, 2); // /f and /g
  assert.equal(plan.totalCount, 10);
});

test('collapsed list shows at most the five most recent non-favorites', () => {
  const entries = Array.from({ length: 9 }, (_, i) => entry(`/folder-${i}`));
  const plan = libraryListPlan(entries, '', false);
  assert.equal(plan.visible.length, LIBRARY_LIST_RECENT_LIMIT);
  assert.deepEqual(names(plan), ['/folder-0', '/folder-1', '/folder-2', '/folder-3', '/folder-4']);
  assert.equal(plan.hiddenCount, 4);
  assert.equal(plan.totalCount, 9);
});

test('the active folder is excluded from the list but counted in the total', () => {
  const entries = [entry('/active'), entry('/fav', true), entry('/other')];
  const plan = libraryListPlan(entries, '/active', false);
  assert.deepEqual(names(plan), ['/fav', '/other']);
  assert.equal(plan.totalCount, 3);
  // Excluding the active folder frees a slot for the next non-favorite.
  const seven = [entry('/active'), ...Array.from({ length: 6 }, (_, i) => entry(`/n${i}`))];
  assert.deepEqual(names(libraryListPlan(seven, '/active', false)), ['/n0', '/n1', '/n2', '/n3', '/n4']);
  assert.equal(libraryListPlan(seven, '/active', false).hiddenCount, 1);
});

test('active-folder exclusion uses folder-reference semantics, not string identity', () => {
  const entries = [entry('/active/'), entry('/other')];
  const plan = libraryListPlan(entries, '/active', false);
  assert.deepEqual(names(plan), ['/other']);
  assert.equal(plan.totalCount, 2);
});

test('expanded shows every row, favorites still first, and keeps the hidden count', () => {
  const entries = [
    entry('/active'),
    entry('/a'),
    entry('/fav', true),
    ...Array.from({ length: 7 }, (_, i) => entry(`/n${i}`)),
  ];
  const plan = libraryListPlan(entries, '/active', true);
  assert.deepEqual(names(plan), ['/fav', '/a', '/n0', '/n1', '/n2', '/n3', '/n4', '/n5', '/n6']);
  // hiddenCount reports what collapsing would hide, so the expanded list
  // knows to offer "Show fewer".
  assert.equal(plan.hiddenCount, 3);
  assert.equal(plan.totalCount, 10);
});

test('no disclosure control is needed when everything already fits', () => {
  const entries = [entry('/fav', true), entry('/a'), entry('/b')];
  const plan = libraryListPlan(entries, '', false);
  assert.deepEqual(names(plan), ['/fav', '/a', '/b']);
  assert.equal(plan.hiddenCount, 0);
  assert.equal(plan.totalCount, 3);
});

test('a just-opened active folder missing from the membership list still counts once', () => {
  const entries = [entry('/a'), entry('/b')];
  const plan = libraryListPlan(entries, '/just-opened', false);
  assert.deepEqual(names(plan), ['/a', '/b']);
  assert.equal(plan.totalCount, 3);
  // …but an empty active path adds nothing.
  assert.equal(libraryListPlan(entries, '', false).totalCount, 2);
});

test('an empty library yields an empty plan', () => {
  const plan = libraryListPlan([], '', false);
  assert.deepEqual(plan.visible, []);
  assert.equal(plan.hiddenCount, 0);
  assert.equal(plan.totalCount, 0);
});
