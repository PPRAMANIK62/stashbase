'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');
const {
  CHANNEL,
  createBugReportReviewIpcHandlers,
  registerBugReportReviewIpc,
} = require('./bug-report-review-ipc.cjs');
const { createBugReportReviewWindow } = require('./bug-report-review-window.cjs');
const { createBugReportService } = require('./bug-report-service.cjs');

function createReviewService() {
  let artifact = 0;
  return createBugReportService({
    createId: () => 'opaque-draft',
    createArtifactId: () => `opaque-artifact-${++artifact}`,
    now: () => Date.parse('2026-08-06T12:00:00.000Z'),
    captureScreenshot: () => ({
      bytes: Buffer.from('approved-lossless-png'),
      mimeType: 'image/png',
      width: 1280,
      height: 800,
      sourcePath: 'C:\\Users\\Someone\\private-window.png',
      windowHandle: 'private-native-window-handle',
    }),
    collectLog: () => ({
      text: 'INFO MCP_BEARER_TOKEN=[REDACTED]\nINFO ready\n',
      byteLength: 49,
      truncated: true,
      redactionCount: 1,
      originalText: 'INFO MCP_BEARER_TOKEN=super-secret',
      filePath: 'C:\\Users\\Someone\\server.log',
    }),
    collectDiagnostics: () => ({
      schemaVersion: 1,
      capturedAt: '2026-08-06T12:00:00.000Z',
      app: {
        name: 'StashBase', version: '1.2.3', packaged: false, electronVersion: '37.0.0',
      },
      os: { platform: 'linux', release: '6.1', arch: 'x64' },
      environment: { API_KEY: 'never-exposed' },
      internalPath: '/home/Jane Doe/private',
    }),
  });
}

test('review IPC derives the draft from its sender and returns only the safe review model', async () => {
  const service = createReviewService();
  const created = await service.createDraft({ webContentsId: 17, windowId: 'private-source-window' });
  assert.equal(service.bindReviewWindow(created.draft.id, 29).ok, true);
  const sessions = new Map([[29, created.draft.id]]);
  const handlers = createBugReportReviewIpcHandlers({
    bugReports: service,
    draftIdForSender: (senderId) => sessions.get(senderId),
    prepareApprovedReport: async () => ({ ok: true, prepared: { artifactCount: 0 } }),
    openPreparedReport: async () => ({ ok: true }),
    savePreparedReport: async () => ({ ok: true }),
  });

  const result = handlers.get({ sender: { id: 29 } });
  assert.equal(result.ok, true);
  assert.equal('id' in result.draft, false);
  const screenshot = result.draft.artifacts.find((item) => item.kind === 'screenshot');
  const log = result.draft.artifacts.find((item) => item.kind === 'log');
  const screenshotPreview = handlers.getArtifactPreview({ sender: { id: 29 } }, screenshot.id);
  const logPreview = handlers.getArtifactPreview({ sender: { id: 29 } }, log.id);
  assert.equal(screenshotPreview.ok, true);
  assert.match(screenshotPreview.preview.dataUrl, /^data:image\/png;base64,/);
  assert.equal(Buffer.isBuffer(screenshotPreview.preview.dataUrl), false);
  assert.deepEqual(
    Buffer.from(screenshotPreview.preview.dataUrl.split(',')[1], 'base64'),
    Buffer.from('approved-lossless-png'),
  );
  assert.equal(screenshotPreview.preview.width, 1280);
  assert.equal(screenshotPreview.preview.height, 800);
  assert.equal(logPreview.preview.text, 'INFO MCP_BEARER_TOKEN=[REDACTED]\nINFO ready\n');
  const serialized = JSON.stringify({ result, screenshotPreview, logPreview });
  assert.equal(serialized.includes('super-secret'), false);
  assert.equal(serialized.includes('server.log'), false);
  assert.equal(serialized.includes('private-window.png'), false);
  assert.equal(serialized.includes('private-native-window-handle'), false);
  assert.equal(serialized.includes('never-exposed'), false);
  assert.equal(serialized.includes('/home/Jane Doe/private'), false);
  assert.equal(serialized.includes('private-source-window'), false);
});

test('review IPC rejects unbound senders and cannot be redirected with renderer-controlled draft data', async () => {
  const service = createReviewService();
  const created = await service.createDraft({ webContentsId: 17, windowId: 'window-a' });
  assert.equal(service.bindReviewWindow(created.draft.id, 29).ok, true);
  const handlers = createBugReportReviewIpcHandlers({
    bugReports: service,
    draftIdForSender: (senderId) => (senderId === 29 ? created.draft.id : null),
    prepareApprovedReport: async () => ({ ok: true, prepared: { artifactCount: 0 } }),
    openPreparedReport: async () => ({ ok: true }),
    savePreparedReport: async () => ({ ok: true }),
  });

  assert.equal(handlers.get({ sender: { id: 30 } }).error.code, 'FORBIDDEN');
  assert.equal(handlers.get({ sender: { id: 0 } }).error.code, 'FORBIDDEN');
  const artifact = handlers.get({ sender: { id: 29 } }).draft.artifacts[0];
  assert.equal(handlers.getArtifactPreview({ sender: { id: 30 } }, artifact.id).error.code, 'FORBIDDEN');
  assert.equal(handlers.getArtifactPreview({ sender: { id: 29 } }, 'C:\\private.log').error.code, 'INVALID_ARTIFACT');
  assert.equal(handlers.updateDescription({ sender: { id: 29 } }, {
    happened: '',
    expected: '',
    reproduction: '',
    draftId: 'another-draft',
  }).error.code, 'INVALID_DESCRIPTION');
});

test('Prepare Report hands the main-owned approved snapshot to the handoff and returns no filesystem path', async () => {
  const service = createReviewService();
  const created = await service.createDraft({ webContentsId: 17, windowId: 'window-a' });
  assert.equal(service.bindReviewWindow(created.draft.id, 29).ok, true);
  let handedOffSnapshot = null;
  let openedReports = 0;
  let savedReports = 0;
  const handlers = createBugReportReviewIpcHandlers({
    bugReports: service,
    draftIdForSender: () => created.draft.id,
    prepareApprovedReport: async (snapshot) => {
      handedOffSnapshot = snapshot;
      return { ok: true, prepared: { artifactCount: snapshot.artifacts.length } };
    },
    openPreparedReport: async () => { openedReports += 1; return { ok: true }; },
    savePreparedReport: async () => { savedReports += 1; return { ok: true }; },
  });
  const event = { sender: { id: 29 } };
  const initial = handlers.get(event).draft;
  const screenshot = initial.artifacts.find((item) => item.kind === 'screenshot');
  const log = initial.artifacts.find((item) => item.kind === 'log');

  assert.equal(handlers.updateDescription(event, {
    happened: 'It stopped responding.',
    expected: 'The document should open.',
    reproduction: 'Open the document twice.',
  }).ok, true);
  assert.equal(handlers.excludeArtifact(event, screenshot.id).ok, true);
  assert.equal(handlers.excludeArtifact(event, log.id).ok, true);
  assert.equal(handlers.includeArtifact(event, log.id).ok, true);
  const approved = await handlers.prepare(event);

  assert.equal(approved.ok, true);
  assert.deepEqual(approved.report.description, {
    happened: 'It stopped responding.',
    expected: 'The document should open.',
    reproduction: 'Open the document twice.',
  });
  assert.equal(approved.report.artifacts.some((item) => item.kind === 'screenshot'), false);
  assert.equal(approved.report.artifacts.some((item) => item.kind === 'log'), true);
  assert.equal(handedOffSnapshot.artifacts.some((item) => item.kind === 'screenshot'), false);
  assert.equal(handedOffSnapshot.artifacts.some((item) => item.kind === 'log'), true);
  assert.equal(handedOffSnapshot.artifacts.find((item) => item.kind === 'log').resource.text,
    'INFO MCP_BEARER_TOKEN=[REDACTED]\nINFO ready\n');
  assert.deepEqual(approved.prepared, { artifactCount: 2 });
  assert.equal(openedReports, 0);
  assert.equal(savedReports, 0);
  assert.equal(/path|directory|folder/i.test(JSON.stringify(approved)), false);

  assert.equal((await handlers.openGitHub(event)).ok, true);
  assert.equal(openedReports, 1);
  assert.equal((await handlers.saveArtifacts(event)).ok, true);
  assert.equal(savedReports, 1);
});

test('review IPC registers only the nine explicit review and handoff operations', () => {
  const registered = new Map();
  const ipcMain = { handle: (channel, handler) => registered.set(channel, handler) };
  const service = createReviewService();
  registerBugReportReviewIpc({
    ipcMain,
    bugReports: service,
    draftIdForSender: () => null,
    prepareApprovedReport: async () => ({ ok: true, prepared: { artifactCount: 0 } }),
    openPreparedReport: async () => ({ ok: true }),
    savePreparedReport: async () => ({ ok: true }),
  });

  assert.equal(Object.values(CHANNEL).length, 9);
  assert.deepEqual([...registered.keys()].sort(), Object.values(CHANNEL).sort());
  assert.equal([...registered.keys()].some((channel) => /file|path|screen/i.test(channel)), false);
});

test('review window is isolated, local-only, and denies popup or arbitrary navigation', async () => {
  const instances = [];
  class FakeBrowserWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.destroyed = false;
      this.shown = false;
      this.menuVisible = true;
      this.webContents = new EventEmitter();
      this.webContents.id = 29;
      this.webContents.setWindowOpenHandler = (handler) => { this.openHandler = handler; };
      instances.push(this);
    }

    setMenuBarVisibility(value) { this.menuVisible = value; }
    isDestroyed() { return this.destroyed; }
    show() { this.shown = true; }
    loadFile(file) { this.loadedFile = file; return Promise.resolve(); }
  }
  const htmlPath = path.join(__dirname, 'bug-report-review.html');
  const preloadPath = path.join(__dirname, 'bug-report-review-preload.cjs');
  const result = createBugReportReviewWindow({ BrowserWindow: FakeBrowserWindow, htmlPath, preloadPath });
  const win = instances[0];

  assert.equal(win.options.parent, undefined);
  assert.equal(win.options.modal, undefined);
  assert.equal(win.options.webPreferences.preload, preloadPath);
  assert.equal(win.options.webPreferences.contextIsolation, true);
  assert.equal(win.options.webPreferences.nodeIntegration, false);
  assert.equal(win.options.webPreferences.webSecurity, true);
  assert.deepEqual(win.openHandler({ url: 'https://example.com' }), { action: 'deny' });
  let prevented = false;
  win.webContents.emit('will-navigate', { preventDefault: () => { prevented = true; } }, 'file:///private/file.txt');
  assert.equal(prevented, true);
  prevented = false;
  win.webContents.emit('will-navigate', { preventDefault: () => { prevented = true; } }, pathToFileURL(htmlPath).toString());
  assert.equal(prevented, false);
  win.emit('ready-to-show');
  assert.equal(win.shown, true);
  assert.equal(win.menuVisible, false);
  await result.loaded;
  assert.equal(win.loadedFile, htmlPath);
});

test('dedicated review preload contains no generic filesystem or source-selection bridge', () => {
  const preload = fs.readFileSync(path.join(__dirname, 'bug-report-review-preload.cjs'), 'utf8');
  assert.equal(/readFile|deleteFile|openFile|capturePage|desktopCapturer|sourceWindow|draftId/.test(preload), false);
  assert.match(preload, /updateDescription/);
  assert.match(preload, /getArtifactPreview/);
  assert.match(preload, /includeArtifact/);
  assert.match(preload, /excludeArtifact/);
  assert.match(preload, /prepare/);
  assert.match(preload, /openGitHub/);
  assert.match(preload, /saveArtifacts/);
  assert.match(preload, /discard/);
  assert.equal(/createArtifact|attachArtifact|writeFile|saveFile/.test(preload), false);
});

test('review page has a local-only CSP and all required review controls', () => {
  const html = fs.readFileSync(path.join(__dirname, 'bug-report-review.html'), 'utf8');
  const renderer = fs.readFileSync(path.join(__dirname, 'bug-report-review-renderer.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, 'bug-report-review.css'), 'utf8');
  assert.match(html, /default-src 'none'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /What happened\?/);
  assert.match(html, /What did you expect to happen\?/);
  assert.match(html, /Steps to reproduce/);
  assert.match(html, /Prepare Report/);
  assert.match(html, /id="report-ready"[\s\S]*Report ready/);
  assert.match(html, /temporary prepared files will be cleared the next time StashBase starts/i);
  assert.match(html, /File Explorer will open with your prepared artifacts/);
  assert.match(html, /Open GitHub/);
  assert.match(html, /Save Selected Artifacts/);
  assert.equal(/Approve report/i.test(html), false);
  assert.match(html, /id="artifact-summary"/);
  assert.match(html, /id="artifact-summary-groups"/);
  assert.equal(/https?:\/\//.test(html), false);
  assert.match(renderer, /artifact-selection/);
  assert.match(renderer, /reviewFlow\.hidden = true/);
  assert.match(renderer, /reportReady\.hidden = false/);
  assert.match(renderer, /api\.openGitHub\(\)/);
  assert.match(renderer, /api\.saveArtifacts\(\)/);
  assert.match(renderer, /Captured and prepared as a lossless PNG/);
  assert.match(renderer, /does not resize, recompress, or convert it/);
  assert.match(renderer, /Exact captured PNG eligible for attachment, without format conversion/);
  assert.match(renderer, /artifact\.included \? 'Included' : 'Include'/);
  assert.match(renderer, /artifact\.included \? 'Exclude' : 'Excluded'/);
  assert.match(renderer, /aria-pressed/);
  assert.match(renderer, /model\.artifacts\.filter\(\(artifact\) => artifact\.included\)/);
  assert.match(renderer, /model\.artifacts\.filter\(\(artifact\) => !artifact\.included\)/);
  assert.match(renderer, /renderArtifactSummaryGroup\('Included', included, '✓', 'included'\)/);
  assert.match(renderer, /renderArtifactSummaryGroup\('Excluded', excluded, '×', 'excluded'\)/);
  assert.match(renderer, /renderArtifacts\(\)[\s\S]*renderArtifactSummary\(\)/);
  assert.match(renderer, /document\.createElement\('details'\)/);
  assert.match(renderer, /log-preview/);
  assert.match(renderer, /View full size/);
  assert.match(renderer, /Fit to view/);
  assert.match(renderer, /addEventListener\('wheel',[\s\S]*passive: false/);
  assert.match(renderer, /Math\.exp\(-delta \* 0\.002\)/);
  assert.match(renderer, /if \(zoomBy\([\s\S]*event\.preventDefault\(\)/);
  assert.match(renderer, /addEventListener\('pointerdown'/);
  assert.match(renderer, /pointerDistanceAndCenter/);
  assert.match(renderer, /pinch\.distance \/ pinchDistance/);
  assert.match(renderer, /Math\.min\(1, availableWidth \/ preview\.width, availableHeight \/ preview\.height\)/);
  assert.match(renderer, /image\.style\.width = `\$\{displayWidth\}px`/);
  assert.match(renderer, /image\.style\.height = `\$\{displayHeight\}px`/);
  assert.equal(/image\/jpeg|toDataURL\([^)]*jpeg/i.test(renderer), false);
  assert.match(renderer, /applyZoom\(1\)/);
  assert.match(renderer, /fitScale = calculateFitScale\(\)[\s\S]*applyZoom\(1\)/);
  assert.match(renderer, /new ResizeObserver\([\s\S]*zoomFromFit <= 1\.001[\s\S]*fitToView\(\)/);
  assert.match(css, /\.selection-option\.include\.is-selected/);
  assert.match(css, /\.selection-option\.exclude\.is-selected/);
  assert.match(css, /\.selection-option:not\(\.is-selected\)[\s\S]*color:\s*#4f4d47/);
  assert.match(css, /\.artifact-summary-group\.included \.artifact-summary-marker/);
  assert.match(css, /\.artifact-summary-group\.excluded \.artifact-summary-marker/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)[\s\S]*\.selection-option:not\(\.is-selected\)/);
  assert.match(css, /\.log-preview[\s\S]*overflow:\s*auto/);
  assert.match(css, /\.screenshot-frame\.is-zoomed/);
  assert.match(css, /\.screenshot-frame[\s\S]*overflow:\s*auto/);
  assert.match(css, /\.screenshot-stage[\s\S]*align-items:\s*center[\s\S]*justify-content:\s*center/);
  assert.match(css, /\.screenshot-stage img[\s\S]*max-width:\s*none[\s\S]*max-height:\s*none/);
  assert.match(css, /touch-action:\s*none/);
});

test('review approval has no renderer or review-service artifact writer', () => {
  const sources = [
    'bug-report-review-renderer.js',
    'bug-report-review-preload.cjs',
    'bug-report-review-ipc.cjs',
    'bug-report-service.cjs',
  ].map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8')).join('\n');

  assert.equal(/writeFile(?:Sync)?|createWriteStream|mkdtemp|tmpdir\(|showSaveDialog/.test(sources), false);
  assert.equal(/createArtifact|attachArtifact|saveFile/.test(
    fs.readFileSync(path.join(__dirname, 'bug-report-review-preload.cjs'), 'utf8'),
  ), false);
});

test('native menu action is wired to the real review flow rather than a placeholder', () => {
  const main = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');
  assert.match(main, /onReportBug:[\s\S]{0,240}openBugReportReview/);
  assert.equal(main.includes('openBugReportPlaceholder'), false);
  assert.equal(main.includes('Bug report draft created.'), false);
});

test('Save Selected Artifacts uses a native main-process directory picker', () => {
  const main = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');
  assert.match(main, /title: 'Save Selected Artifacts'/);
  assert.match(main, /properties: \['openDirectory', 'createDirectory'\]/);
  assert.match(main, /dialog\.showOpenDialog/);
  assert.match(main, /bugReportHandoff\.saveArtifacts\(snapshot, result\.filePaths\[0\]\)/);
});
