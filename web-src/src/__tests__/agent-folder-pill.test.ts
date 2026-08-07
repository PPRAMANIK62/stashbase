import assert from 'node:assert/strict';
import test from 'node:test';
import {
  folderDisplayName,
  folderMenuEntries,
  folderMenuLocked,
  folderMenuVisible,
  folderPillAriaLabel,
  folderPillFolder,
  nextSessionFolder,
  shortenFolderPath,
} from '../components/agent/folderState.ts';

const recent = [
  { path: '/Users/me/Documents/StashBase/Notes', openedAt: '2026-08-01', favorite: false },
  { path: '/Users/me/Projects/Research', openedAt: '2026-08-02', favorite: true },
  { path: '/tmp/scratch', openedAt: '2026-08-03' },
];
const members = recent.map((entry) => entry.path);

test('folder menu lists library membership with favorites pinned and the window folder ensured', () => {
  const entries = folderMenuEntries(recent, '/Users/me/Documents/StashBase/Notes');
  assert.deepEqual(entries.map((entry) => entry.path), [
    '/Users/me/Projects/Research',
    '/Users/me/Documents/StashBase/Notes',
    '/tmp/scratch',
  ]);

  const withMissingCurrent = folderMenuEntries(recent, '/Users/me/Elsewhere');
  assert.equal(withMissingCurrent[0].path, '/Users/me/Elsewhere');

  assert.equal(folderMenuVisible(entries), true);
  assert.equal(folderMenuVisible(folderMenuEntries([], '')), false);
});

test('an unbound tab follows the window folder until the user picks one', () => {
  assert.equal(nextSessionFolder(undefined, '/Users/me/Documents/StashBase/Notes', members), '/Users/me/Documents/StashBase/Notes');
  // Explicit pick wins over the window folder.
  assert.equal(nextSessionFolder('/tmp/scratch', '/Users/me/Documents/StashBase/Notes', members), '/tmp/scratch');
  // A window switch moves the default with it when nothing was picked.
  assert.equal(nextSessionFolder(undefined, '/Users/me/Projects/Research', members), '/Users/me/Projects/Research');
});

test('a pick that left library membership falls back to the window folder', () => {
  assert.equal(nextSessionFolder('/gone/removed-folder', '/Users/me/Projects/Research', members), '/Users/me/Projects/Research');
});

test('a connected session keeps its binding regardless of later window switches', () => {
  const bound = folderPillFolder({
    connectedFolder: '/tmp/scratch',
    picked: undefined,
    windowFolder: '/Users/me/Projects/Research',
    memberPaths: members,
  });
  assert.equal(bound, '/tmp/scratch');

  const unbound = folderPillFolder({
    connectedFolder: null,
    picked: undefined,
    windowFolder: '/Users/me/Projects/Research',
    memberPaths: members,
  });
  assert.equal(unbound, '/Users/me/Projects/Research');
});

test('the pill locks once the conversation has content, a turn runs, or the session is resumed', () => {
  assert.equal(folderMenuLocked(false, false, false), false);
  assert.equal(folderMenuLocked(true, false, false), true);
  assert.equal(folderMenuLocked(false, true, false), true);
  assert.equal(folderMenuLocked(false, false, true), true);
});

test('pill labels expose the binding and its locked state', () => {
  assert.equal(folderDisplayName('/Users/me/Projects/Research'), 'Research');
  assert.equal(shortenFolderPath('/Users/me/Projects/Research', '/Users/me'), '~/Projects/Research');
  assert.equal(shortenFolderPath('/srv/data', '/Users/me'), '/srv/data');
  assert.equal(folderPillAriaLabel('Research', false), 'Session folder: Research');
  assert.equal(
    folderPillAriaLabel('Research', true),
    'Session folder: Research — set for this conversation',
  );
});
