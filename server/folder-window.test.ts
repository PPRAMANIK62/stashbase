import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  clearCurrentFolder,
  getActiveFolders,
  runWithFolderRoot,
} from './folder.ts';
import { filesystemPath } from './filesystem-path.ts';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test('releasing one window folder context preserves other live windows', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-window-context-'));
  const first = path.join(root, 'first');
  const second = path.join(root, 'second');
  fs.mkdirSync(first);
  fs.mkdirSync(second);

  const firstReady = deferred();
  const secondReady = deferred();
  const releaseFirst = deferred();
  const releaseSecond = deferred();

  const firstScope = runWithFolderRoot(first, async () => {
    firstReady.resolve();
    await releaseFirst.promise;
  });
  const secondScope = runWithFolderRoot(second, async () => {
    secondReady.resolve();
    await releaseSecond.promise;
  });

  try {
    await Promise.all([firstReady.promise, secondReady.promise]);
    const active = getActiveFolders();
    const firstWindow = active.find((entry) => filesystemPath.equal(entry.path, first));
    const secondWindow = active.find((entry) => filesystemPath.equal(entry.path, second));
    assert.ok(firstWindow);
    assert.ok(secondWindow);

    clearCurrentFolder(firstWindow.windowId);
    const remaining = getActiveFolders();
    assert.equal(remaining.some((entry) => entry.windowId === firstWindow.windowId), false);
    assert.equal(remaining.some((entry) => entry.windowId === secondWindow.windowId), true);
  } finally {
    releaseFirst.resolve();
    releaseSecond.resolve();
    await Promise.all([firstScope, secondScope]);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
