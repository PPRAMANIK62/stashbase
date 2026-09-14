'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { MacUpdater } = require('electron-updater/out/MacUpdater');
const { createUpdateManager } = require('../update-manager.cjs');
const { createUpdateInstaller } = require('../update-install-strategy.cjs');
const { createWindowLifecycleUpdateBarrier } = require('../update-window-barrier.cjs');

/** Real renderer save replies and native window locks, with a controlled
 * Squirrel delay. Never downloads, replaces the app, or quits the test runner. */
async function runUpdateInstallSmoke({ windows, lifecycle, isLiveWindow }) {
  const barrier = createWindowLifecycleUpdateBarrier({
    lifecycle: () => lifecycle, getWindows: () => windows, isLiveWindow,
    onBlocked: () => { throw new Error('built renderers refused the update save'); },
  });
  const native = new EventEmitter();
  let nativeChecks = 0;
  let installs = 0;
  native.checkForUpdates = () => { nativeChecks += 1; };
  native.quitAndInstall = () => {
    assert.ok(windows.every((win) => !win.isEnabled()));
    installs += 1;
  };
  // Run the installed MacUpdater implementation, including its asynchronous
  // Squirrel handoff, on every CI platform without touching a native updater.
  const updater = Object.assign(Object.create(MacUpdater.prototype), {
    nativeUpdater: native, squirrelDownloadedUpdate: false,
    autoRunAppAfterInstall: true, closeServerIfExists() {},
  });
  const manager = createUpdateManager({
    updater, currentVersion: '2.0.0', isPackaged: true,
    readAutoCheck: async () => false,
    beforeInstall: barrier.prepare, afterInstallFailure: barrier.revoke,
    installUpdate: createUpdateInstaller({ updater, platform: 'darwin' }),
  });
  try {
    await manager.start();
    updater.emit('update-downloaded', { version: '2.1.0' });
    assert.equal((await manager.primaryAction()).phase, 'installing');
    assert.equal(nativeChecks, 1);
    assert.equal(installs, 0);
    assert.ok(windows.every((win) => !win.isEnabled()));
    assert.equal(barrier.isActive(), true);
    // The native installer is still waiting after the built renderers saved.
    await new Promise((resolve) => setImmediate(resolve));
    native.emit('update-downloaded');
    assert.equal(installs, 1);
    updater.emit('error', new Error('controlled install failure'));
    assert.equal(manager.getState().phase, 'error');
    assert.equal(barrier.isActive(), false);
    assert.ok(windows.every((win) => win.isEnabled()));
    console.log('real two-window update save, delayed native install, and rollback smoke passed');
  } finally {
    barrier.revoke();
    manager.dispose();
    native.removeAllListeners();
  }
}

module.exports = { runUpdateInstallSmoke };
