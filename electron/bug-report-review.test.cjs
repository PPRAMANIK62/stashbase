'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { createBugReportReviewWindow } = require('./bug-report-review-window.cjs');

test('replacement review window sandboxes the app:// page and denies every other origin', async () => {
  const instances = [];
  class FakeBrowserWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.webContents = new EventEmitter();
      this.webContents.id = 33;
      this.webContents.setWindowOpenHandler = (handler) => { this.openHandler = handler; };
      instances.push(this);
    }

    setMenuBarVisibility() {}
    isDestroyed() { return false; }
    show() { this.shown = true; }
    loadURL(url) { this.loadedUrl = url; return Promise.resolve(); }
  }
  const preloadPath = path.join(
    __dirname, '..', 'dist', 'electron', 'bug-report', 'review-window-preload.cjs',
  );
  const result = createBugReportReviewWindow({
    BrowserWindow: FakeBrowserWindow,
    preloadPath,
    appUrl: 'app://renderer/bug-report.html',
  });
  const win = instances[0];

  assert.equal(win.options.webPreferences.preload, preloadPath);
  assert.equal(win.options.webPreferences.sandbox, true);
  assert.equal(win.options.webPreferences.contextIsolation, true);
  assert.equal(win.options.webPreferences.nodeIntegration, false);
  assert.equal(win.options.webPreferences.webviewTag, false);
  assert.equal(win.options.webPreferences.experimentalFeatures, false);
  assert.equal(win.options.webPreferences.spellcheck, true);
  assert.equal(win.options.parent, undefined);
  assert.equal(win.options.fullscreenable, false);
  assert.deepEqual(win.openHandler({ url: 'https://example.com' }), { action: 'deny' });

  const navigate = (event, url) => {
    let prevented = false;
    win.webContents.emit(event, { preventDefault: () => { prevented = true; } }, url);
    return prevented;
  };
  assert.equal(navigate('will-navigate', 'app://renderer/bug-report.html#ready'), false);
  assert.equal(navigate('will-navigate', 'file:///private/file.txt'), true);
  assert.equal(navigate('will-redirect', 'https://example.com/'), true);
  assert.equal(navigate('will-attach-webview', undefined), true);

  await result.loaded;
  assert.equal(win.loadedUrl, 'app://renderer/bug-report.html');
  assert.throws(
    () => createBugReportReviewWindow({ BrowserWindow: FakeBrowserWindow, preloadPath }),
    TypeError,
  );

  // Vite development serves the same page from the development origin, and
  // the guard follows the origin it was given rather than assuming app://.
  createBugReportReviewWindow({
    BrowserWindow: FakeBrowserWindow,
    preloadPath,
    appUrl: 'http://127.0.0.1:8090/bug-report.html',
    appOrigin: 'http://127.0.0.1:8090',
  });
  const development = instances[1];
  const navigateDevelopment = (url) => {
    let prevented = false;
    development.webContents.emit('will-navigate', { preventDefault: () => { prevented = true; } }, url);
    return prevented;
  };
  assert.equal(development.options.webPreferences.sandbox, true);
  assert.equal(navigateDevelopment('http://127.0.0.1:8090/bug-report.html#ready'), false);
  assert.equal(navigateDevelopment('http://127.0.0.1:5173/bug-report.html'), true);
  assert.equal(navigateDevelopment('file:///private/file.txt'), true);
});

test('review opened from a full-screen source presents in that space instead of a separate desktop', () => {
  const instances = [];
  class FakeBrowserWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.webContents = new EventEmitter();
      this.webContents.id = 31;
      this.webContents.setWindowOpenHandler = () => {};
      instances.push(this);
    }

    setMenuBarVisibility() {}
    setAlwaysOnTop(flag, level) { this.alwaysOnTop = { flag, level }; }
    setVisibleOnAllWorkspaces(visible, options) { this.allWorkspaces = { visible, options }; }
    isDestroyed() { return false; }
    loadURL() { return Promise.resolve(); }
  }
  const deps = {
    BrowserWindow: FakeBrowserWindow,
    appUrl: 'app://renderer/bug-report.html',
    preloadPath: path.join(
      __dirname, '..', 'dist', 'electron', 'bug-report', 'review-window-preload.cjs',
    ),
  };

  createBugReportReviewWindow({ ...deps, sourceWindow: { isDestroyed: () => false, isFullScreen: () => true } });
  assert.deepEqual(instances[0].alwaysOnTop, { flag: true, level: 'floating' });
  assert.deepEqual(instances[0].allWorkspaces, {
    visible: true,
    options: { visibleOnFullScreen: true, skipTransformProcessType: true },
  });
  // The review window stays an independent dialog: never a child, never full screen itself.
  assert.equal(instances[0].options.parent, undefined);
  assert.equal(instances[0].options.fullscreenable, false);

  createBugReportReviewWindow({ ...deps, sourceWindow: { isDestroyed: () => false, isFullScreen: () => false } });
  assert.equal(instances[1].alwaysOnTop, undefined);
  assert.equal(instances[1].allWorkspaces, undefined);

  createBugReportReviewWindow({ ...deps, sourceWindow: { isDestroyed: () => true, isFullScreen: () => true } });
  assert.equal(instances[2].alwaysOnTop, undefined);
  assert.equal(instances[2].allWorkspaces, undefined);
});

test('every launch opens the same renderer review page, never a second static one', () => {
  const main = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');
  // One page, one preload: development differs only in the origin serving it.
  assert.match(main, /BUG_REPORT_REVIEW_URL = USE_DEV_VITE[\s\S]{0,160}bug-report\.html/);
  assert.match(main, /appUrl: BUG_REPORT_REVIEW_URL,\s*\n\s*appOrigin: RENDERER_ORIGIN,/);
  assert.match(main, /review-window-preload\.cjs/);
  assert.equal(/bug-report-review\.html|bug-report-review-preload/.test(main), false);
  const entries = fs.readdirSync(__dirname);
  assert.equal(entries.some((entry) => /^bug-report-review\.(html|css)$/.test(entry)), false);
  assert.equal(entries.includes('bug-report-review-renderer.js'), false);
});

test('review approval has no renderer or review-service artifact writer', () => {
  const sources = [
    'bug-report/review-ipc.ts',
    'bug-report/review-preload.ts',
    'bug-report/review-window-preload.ts',
    'bug-report-service.cjs',
  ].map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8')).join('\n');

  assert.equal(/writeFile(?:Sync)?|createWriteStream|mkdtemp|tmpdir\(|showSaveDialog/.test(sources), false);
  assert.equal(/createArtifact|attachArtifact|saveFile/.test(
    fs.readFileSync(path.join(__dirname, 'bug-report/review-preload.ts'), 'utf8'),
  ), false);
});

test('native menu action is wired to the real review flow rather than a placeholder', () => {
  const main = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');
  assert.match(main, /onReportBug:[\s\S]{0,240}openBugReportReview/);
  assert.equal(main.includes('openBugReportPlaceholder'), false);
  assert.equal(main.includes('Bug report draft created.'), false);
});

test('Download saves to the Downloads folder without a picker dialog', () => {
  const main = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');
  assert.match(main, /savePreparedReport: \(snapshot\) => bugReportHandoff\.saveToDownloads\(snapshot\)/);
  assert.match(main, /downloadsDirectory: async \(\) => app\.getPath\('downloads'\)/);
  assert.equal(/Save Report Files|Save Selected Artifacts/.test(main), false);
});
