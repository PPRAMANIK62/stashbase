import assert from 'node:assert/strict';
import test from 'node:test';
import {
  crossFolderListingRoot,
  folderDisplayName,
  folderMenuEntries,
  folderMenuLocked,
  folderMenuVisible,
  folderPillAriaLabel,
  folderPillFolder,
  nextSessionFolder,
  shortenFolderPath,
  shouldFollowWindowFolder,
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

test('only an unbound, empty, idle tab follows a window folder switch', () => {
  const base = {
    connectedFolder: '/tmp/scratch',
    picked: undefined,
    resumedSession: false,
    hasContent: false,
    turnActive: false,
    windowFolder: '/Users/me/Projects/Research',
  };
  assert.equal(shouldFollowWindowFolder(base), true);
  // Same folder → nothing to follow.
  assert.equal(shouldFollowWindowFolder({ ...base, windowFolder: '/tmp/scratch' }), false);
  // A conversation with content, a running turn, an explicit pick, or a
  // resumed session never rebinds.
  assert.equal(shouldFollowWindowFolder({ ...base, hasContent: true }), false);
  assert.equal(shouldFollowWindowFolder({ ...base, turnActive: true }), false);
  assert.equal(shouldFollowWindowFolder({ ...base, picked: '/tmp/scratch' }), false);
  assert.equal(shouldFollowWindowFolder({ ...base, resumedSession: true }), false);
  // No live binding yet, or no window folder → the next connect handles it.
  assert.equal(shouldFollowWindowFolder({ ...base, connectedFolder: null }), false);
  assert.equal(shouldFollowWindowFolder({ ...base, windowFolder: '' }), false);
});

test('mention/attachment scoping uses the session folder only when it differs from the window', () => {
  assert.equal(crossFolderListingRoot('/tmp/scratch', '/Users/me/Projects/Research'), '/tmp/scratch');
  assert.equal(crossFolderListingRoot('/tmp/scratch', '/tmp/scratch'), null);
  assert.equal(crossFolderListingRoot(null, '/Users/me/Projects/Research'), null);
  assert.equal(crossFolderListingRoot('/tmp/scratch', ''), null);
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
