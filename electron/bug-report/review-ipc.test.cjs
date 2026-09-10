'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createBugReportReviewIpcHandlers,
  registerBugReportReviewIpc,
} = require('../../dist/electron/bug-report/review-ipc.cjs');
const { createBugReportService } = require('../bug-report-service.cjs');

const REVIEW_URL = 'app://renderer/bug-report.html';
const REVIEW_SENDER_ID = 29;

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

function eventFor({ senderId = REVIEW_SENDER_ID, url = REVIEW_URL, mainFrame = true } = {}) {
  const frame = { url };
  const sender = { id: senderId, mainFrame: mainFrame ? frame : { url } };
  return { sender, senderFrame: frame };
}

async function createHarness(overrides = {}) {
  const service = createReviewService();
  const created = await service.createDraft({
    webContentsId: 17,
    windowId: 'private-source-window',
  });
  assert.equal(service.bindReviewWindow(created.draft.id, REVIEW_SENDER_ID).ok, true);
  const snapshots = [];
  const opened = [];
  const saved = [];
  const handlers = createBugReportReviewIpcHandlers({
    bugReports: service,
    draftIdForSender: (senderId) => (senderId === REVIEW_SENDER_ID ? created.draft.id : null),
    isReviewFrameUrl: (url) => url === REVIEW_URL,
    prepareApprovedReport: async (snapshot) => {
      snapshots.push(snapshot);
      return { ok: true, prepared: { artifactCount: snapshot.artifacts.length } };
    },
    openPreparedReport: async (snapshot) => {
      opened.push(snapshot);
      return { ok: true, prepared: { artifactCount: snapshot.artifacts.length } };
    },
    savePreparedReport: async (snapshot) => {
      saved.push(snapshot);
      return { ok: true, saved: { artifactCount: snapshot.artifacts.length } };
    },
    ...overrides,
  });
  return { created, handlers, opened, saved, service, snapshots };
}

test('review IPC derives the draft from its sender and returns only the safe review model', async () => {
  const { handlers } = await createHarness();
  const event = eventFor();

  const result = await handlers.get(event);
  assert.equal(result.ok, true);
  assert.equal('id' in result.draft, false);
  const screenshot = result.draft.artifacts.find((item) => item.kind === 'screenshot');
  const log = result.draft.artifacts.find((item) => item.kind === 'log');
  const screenshotPreview = await handlers.getArtifactPreview(event, screenshot.id);
  const logPreview = await handlers.getArtifactPreview(event, log.id);

  assert.match(screenshotPreview.preview.dataUrl, /^data:image\/png;base64,/u);
  assert.equal(screenshotPreview.preview.width, 1280);
  assert.equal(logPreview.preview.text, 'INFO MCP_BEARER_TOKEN=[REDACTED]\nINFO ready\n');
  const serialized = JSON.stringify({ logPreview, result, screenshotPreview });
  for (const secret of [
    'super-secret',
    'server.log',
    'private-window.png',
    'private-native-window-handle',
    'never-exposed',
    '/home/Jane Doe/private',
    'private-source-window',
  ]) {
    assert.equal(serialized.includes(secret), false, secret);
  }
});

test('review IPC forbids a subframe, a foreign page, and an unbound sender', async () => {
  const { handlers } = await createHarness();

  const forbidden = [
    await handlers.get(eventFor({ mainFrame: false })),
    await handlers.get(eventFor({ url: 'https://example.com/bug-report.html' })),
    await handlers.get(eventFor({ senderId: 30 })),
    await handlers.get(eventFor({ senderId: 0 })),
    await handlers.getArtifactPreview(eventFor({ senderId: 30 }), 'opaque-artifact-1'),
    await handlers.prepare(eventFor({ url: 'file:///private/file.html' })),
  ];

  for (const response of forbidden) {
    assert.equal(response.ok, false);
    assert.equal(response.error.code, 'FORBIDDEN');
  }
});

test('review IPC rejects request payloads outside the declared shapes', async () => {
  const { handlers } = await createHarness();
  const event = eventFor();

  const rejected = [
    await handlers.getArtifactPreview(event, ''),
    await handlers.includeArtifact(event, { id: 'opaque-artifact-1' }),
    await handlers.excludeArtifact(event, null),
    await handlers.updateDescription(event, {
      draftId: 'another-draft',
      problem: '',
      reproduction: '',
    }),
  ];

  for (const response of rejected) {
    assert.equal(response.ok, false);
    assert.equal(response.error.code, 'INVALID_REQUEST');
  }
  // A well-formed id the service does not own still gets the service's answer.
  assert.equal(
    (await handlers.getArtifactPreview(event, 'C:\\private.log')).error.code,
    'INVALID_ARTIFACT',
  );
});

test('Prepare hands the main-owned snapshot to the handoff and returns no filesystem path', async () => {
  const { handlers, opened, saved, snapshots } = await createHarness();
  const event = eventFor();
  const initial = (await handlers.get(event)).draft;
  const screenshot = initial.artifacts.find((item) => item.kind === 'screenshot');
  const log = initial.artifacts.find((item) => item.kind === 'log');

  assert.equal(
    (await handlers.updateDescription(event, {
      problem: 'The document stopped responding instead of opening.',
      reproduction: 'Open the document twice.',
    })).ok,
    true,
  );
  assert.equal((await handlers.excludeArtifact(event, screenshot.id)).ok, true);
  assert.equal((await handlers.excludeArtifact(event, log.id)).ok, true);
  assert.equal((await handlers.includeArtifact(event, log.id)).ok, true);

  const approved = await handlers.prepare(event);
  assert.equal(approved.ok, true);
  assert.equal(approved.report.state, 'approved');
  assert.equal(approved.report.artifacts.some((item) => item.kind === 'screenshot'), false);
  assert.deepEqual(approved.prepared, { artifactCount: 2 });
  assert.equal(snapshots[0].artifacts.some((item) => item.kind === 'screenshot'), false);
  assert.equal(/path|directory|folder/iu.test(JSON.stringify(approved)), false);
  assert.equal(opened.length, 0);
  assert.equal(saved.length, 0);

  assert.equal((await handlers.openGitHub(event)).ok, true);
  assert.equal((await handlers.saveArtifacts(event)).ok, true);
  assert.equal(opened.length, 1);
  assert.equal(saved.length, 1);
});

test('a failed handoff still names the approved report so the window can retry', async () => {
  const { handlers } = await createHarness({
    prepareApprovedReport: async () => ({
      error: { code: 'DOWNLOADS_FAILED', message: 'The report files could not be saved.' },
      ok: false,
    }),
  });
  const event = eventFor();

  const prepared = await handlers.prepare(event);
  assert.equal(prepared.ok, false);
  assert.equal(prepared.error.code, 'DOWNLOADS_FAILED');
  assert.equal(prepared.report.state, 'approved');
});

test('Back reopens the approved review and a later prepare claims a fresh snapshot', async () => {
  const { handlers, snapshots } = await createHarness();
  const event = eventFor();
  const screenshot = (await handlers.get(event)).draft.artifacts
    .find((item) => item.kind === 'screenshot');

  assert.equal((await handlers.excludeArtifact(event, screenshot.id)).ok, true);
  assert.equal((await handlers.prepare(event)).ok, true);
  assert.equal(snapshots[0].artifacts.some((item) => item.kind === 'screenshot'), false);

  const reopened = await handlers.reopen(event);
  assert.equal(reopened.draft.state, 'reviewing');
  assert.equal(reopened.draft.approval, null);
  const restored = reopened.draft.artifacts.find((item) => item.kind === 'screenshot');
  assert.equal(restored.included, false);

  assert.equal((await handlers.openGitHub(event)).error.code, 'INVALID_STATE');
  assert.equal((await handlers.reopen(event)).error.code, 'INVALID_STATE');
  assert.equal((await handlers.includeArtifact(event, restored.id)).ok, true);
  assert.equal((await handlers.prepare(event)).ok, true);
  assert.equal(snapshots[1].artifacts.some((item) => item.kind === 'screenshot'), true);
  assert.equal((await handlers.discard(event)).ok, true);
});

test('a response outside the declared schema never reaches the renderer', async () => {
  const { handlers } = await createHarness({
    prepareApprovedReport: async (snapshot) => ({
      ok: true,
      prepared: { artifactCount: snapshot.artifacts.length, directory: '/tmp/bug-reports/abc' },
    }),
  });

  const prepared = await handlers.prepare(eventFor());
  assert.equal(prepared.ok, false);
  assert.equal(prepared.error.code, 'UNAVAILABLE');
  assert.equal(JSON.stringify(prepared).includes('/tmp/bug-reports/abc'), false);
});

test('review IPC registers only the ten explicit review and handoff operations', async () => {
  const registered = new Map();
  registerBugReportReviewIpc({
    bugReports: createReviewService(),
    draftIdForSender: () => null,
    ipcMain: { handle: (channel, handler) => registered.set(channel, handler) },
    isReviewFrameUrl: () => false,
    openPreparedReport: async () => ({ ok: true }),
    prepareApprovedReport: async () => ({ ok: true, prepared: { artifactCount: 0 } }),
    savePreparedReport: async () => ({ ok: true }),
  });

  assert.equal(registered.size, 10);
  assert.equal(
    [...registered.keys()].every((channel) => channel.startsWith('bug-report-review:')),
    true,
  );
  assert.equal([...registered.keys()].some((channel) => /file|path|screen/iu.test(channel)), false);
});
