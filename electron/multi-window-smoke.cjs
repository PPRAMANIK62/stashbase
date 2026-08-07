'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, Menu } = require('electron');

const smokeRoot = process.env.STASHBASE_SMOKE_ROOT;
if (!smokeRoot) throw new Error('STASHBASE_SMOKE_ROOT is required');
app.setPath('userData', path.join(smokeRoot, 'electron-user-data'));

const deadline = setTimeout(() => {
  console.error('real multi-window smoke timed out');
  process.exitCode = 1;
  app.quit();
}, 60_000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, message, timeoutMs = 20_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const value = predicate();
    if (value) return value;
    await sleep(50);
  }
  throw new Error(message);
}

async function waitForRenderer(win) {
  await waitFor(
    () => !win.isDestroyed() && !win.webContents.isLoadingMainFrame(),
    'renderer did not finish loading',
  );
  await win.webContents.executeJavaScript(
    "new Promise((resolve) => { if (document.readyState === 'complete') resolve(true); else window.addEventListener('load', () => resolve(true), { once: true }); })",
  );
  await win.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const deadline = Date.now() + 10000;
      const timer = setInterval(() => {
        if (window.electron?.contextReleaseReady?.()) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() >= deadline) {
          clearInterval(timer);
          reject(new Error('renderer save handshake did not become ready'));
        }
      }, 25);
    })
  `);
  // Boot auto-opens the most recent library folder and pushes its own
  // window-folder registration. Wait for that push to settle before this
  // harness assigns folders, so the boot push cannot clobber ours.
  await win.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const deadline = Date.now() + 20000;
      const timer = setInterval(() => {
        if (document.body.dataset.bootSettled === '1') {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() >= deadline) {
          clearInterval(timer);
          reject(new Error('renderer boot did not settle'));
        }
      }, 25);
    })
  `);
}

async function openFolder(win, folder) {
  const script = `
    (async () => {
      const folder = ${JSON.stringify(folder)};
      const windowId = window.electron.windowId;
      const response = await fetch('/api/folder', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-stashbase-window-id': windowId,
        },
        body: JSON.stringify({ path: folder }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || ('HTTP ' + response.status));
      await window.electron.setWindowFolder(payload.current.path);
      return { windowId, path: payload.current.path };
    })()
  `;
  return win.webContents.executeJavaScript(script);
}

async function currentFolder(win) {
  return win.webContents.executeJavaScript(`
    fetch('/api/folder', {
      headers: { 'x-stashbase-window-id': window.electron.windowId },
    }).then((response) => response.json()).then((payload) => payload.current?.path ?? null)
  `);
}

function fileMenuItem(label) {
  const menu = Menu.getApplicationMenu();
  assert.ok(menu);
  const fileMenu = menu.items.find((item) => item.label === 'File');
  const item = fileMenu?.submenu?.items.find((candidate) => candidate.label === label);
  assert.ok(item, `File > ${label} is missing`);
  return item;
}

function clickFileMenuItem(label, fromWindow) {
  const item = fileMenuItem(label);
  item.click?.(item, fromWindow, {});
}

async function pressShortcut(win, keyCode, modifiers) {
  win.show();
  win.focus();
  win.webContents.focus();
  await sleep(50);
  const input = { keyCode, modifiers };
  win.webContents.sendInputEvent({ type: 'keyDown', ...input });
  win.webContents.sendInputEvent({ type: 'keyUp', ...input });
}

function pressNewWindowShortcut(win) {
  return pressShortcut(
    win,
    'N',
    [process.platform === 'darwin' ? 'meta' : 'control', 'shift'],
  );
}

function pressPrimaryCloseWindowShortcut(win) {
  return process.platform === 'darwin'
    ? pressShortcut(win, 'W', ['meta', 'shift'])
    : pressShortcut(win, 'F4', ['alt']);
}

function pressSecondaryCloseWindowShortcut(win) {
  return pressShortcut(win, 'W', ['control', 'shift']);
}

async function run() {
  const foldersRoot = path.join(smokeRoot, 'folders');
  const notes = path.join(foldersRoot, 'notes');
  const research = path.join(foldersRoot, 'research');
  fs.mkdirSync(notes, { recursive: true });
  fs.mkdirSync(research, { recursive: true });

  const first = await waitFor(
    () => BrowserWindow.getAllWindows().find((win) => !win.isDestroyed()),
    'real main entry did not create its initial window',
  );
  await waitForRenderer(first);
  const firstContext = await openFolder(first, notes);

  assert.equal(
    fileMenuItem('New Window').accelerator,
    'CommandOrControl+Shift+N',
  );
  await pressNewWindowShortcut(first);
  const second = await waitFor(
    () => BrowserWindow.getAllWindows().find((win) => win !== first && !win.isDestroyed()),
    'Cmd/Ctrl+Shift+N did not create a second real app window',
  );
  await waitForRenderer(second);
  const secondContext = await openFolder(second, research);
  assert.notEqual(firstContext.windowId, secondContext.windowId);
  assert.equal(BrowserWindow.getAllWindows().length, 2);

  const focused = await second.webContents.executeJavaScript(
    `window.electron.openFolderWindow(${JSON.stringify(notes)})`,
  );
  assert.equal(focused, true);
  assert.equal(BrowserWindow.getAllWindows().length, 2);

  assert.equal(
    fileMenuItem('Close Window').accelerator,
    process.platform === 'darwin' ? 'Command+Shift+W' : 'Alt+F4',
  );
  await pressPrimaryCloseWindowShortcut(first);
  await waitFor(
    () => first.isDestroyed(),
    process.platform === 'darwin'
      ? 'Cmd+Shift+W did not close the first window'
      : 'Alt+F4 did not close the first window',
  );
  assert.equal(second.isDestroyed(), false);
  assert.equal(await currentFolder(second), secondContext.path);

  if (process.platform === 'darwin') {
    await pressPrimaryCloseWindowShortcut(second);
  } else {
    await pressSecondaryCloseWindowShortcut(second);
  }
  await waitFor(
    () => second.isDestroyed(),
    process.platform === 'darwin'
      ? 'Cmd+Shift+W did not close the last window'
      : 'Ctrl+Shift+W did not close the last window',
  );

  if (process.platform === 'darwin') {
    assert.equal(BrowserWindow.getAllWindows().length, 0);
    app.emit('activate');
    const reopened = await waitFor(
      () => BrowserWindow.getAllWindows().find((win) => !win.isDestroyed()),
      'macOS activate did not reopen a real app window',
    );
    await waitForRenderer(reopened);
    clickFileMenuItem('Close Window', reopened);
    await waitFor(() => reopened.isDestroyed(), 'reopened window did not close from the File menu');
    console.log('real multi-window smoke passed: macOS close/reopen/quit');
    app.quit();
    return;
  }

  // Windows/Linux should now enter the real last-window quit path. The parent
  // runner launches this scenario twice against the same state and port, so an
  // orphaned server/daemon or unreleased lock fails the second launch.
  console.log(`real multi-window smoke passed: ${process.platform} last-window quit`);
}

require('./main.cjs');
app.whenReady()
  .then(run)
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
    app.quit();
  });
