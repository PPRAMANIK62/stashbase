'use strict';

const assert = require('node:assert/strict');
const os = require('node:os');
const test = require('node:test');
const {
  ARTIFACT_KIND,
  DRAFT_STATE,
  MAX_REPORT_FIELD_LENGTH,
  createBugReportService,
} = require('./bug-report-service.cjs');

const SAFE_LOG_TEXT = 'INFO MCP_BEARER_TOKEN=[REDACTED]';

function screenshotFixture() {
  return {
    bytes: Buffer.from('private-original-png'),
    mimeType: 'image/png',
    width: 1440,
    height: 900,
    sourcePath: 'C:\\Users\\Someone\\private-window.png',
  };
}

function diagnosticsFixture(overrides = {}) {
  return {
    schemaVersion: 1,
    capturedAt: '2026-08-06T12:00:00.000Z',
    app: {
      name: 'StashBase',
      version: '1.2.3',
      packaged: true,
      electronVersion: '37.0.0',
    },
    os: {
      platform: 'win32',
      release: '10.0.0',
      arch: 'x64',
    },
    ...overrides,
  };
}

function logFixture(text = SAFE_LOG_TEXT) {
  return {
    text,
    byteLength: Buffer.byteLength(text),
    truncated: true,
    redactionCount: 1,
    originalText: 'MCP_BEARER_TOKEN=unredacted-secret',
    filePath: 'C:\\Users\\Someone\\server.log',
  };
}

function createService(overrides = {}) {
  let nextDraftId = 0;
  let nextArtifactId = 0;
  let clock = Date.parse('2026-08-06T12:00:00.000Z');
  return createBugReportService({
    createId: () => `draft-${++nextDraftId}`,
    createArtifactId: () => `artifact-${++nextArtifactId}`,
    now: () => clock++,
    ...overrides,
  });
}

async function createReviewingDraft(service, sourceWebContentsId = 17, reviewWebContentsId = 29) {
  const created = await service.createDraft({
    webContentsId: sourceWebContentsId,
    windowId: `window-${sourceWebContentsId}`,
  });
  assert.equal(created.ok, true);
  const bound = service.bindReviewWindow(created.draft.id, reviewWebContentsId);
  assert.equal(bound.ok, true);
  return { id: created.draft.id, reviewWebContentsId };
}

test('draft creation exposes only safe collection metadata', async () => {
  const rawHome = os.homedir();
  const rawLog = `INFO file=${rawHome} MCP_BEARER_TOKEN=[REDACTED]`;
  const service = createService({
    captureScreenshot: () => screenshotFixture(),
    collectDiagnostics: () => diagnosticsFixture({
      environment: { MCP_BEARER_TOKEN: 'must-never-cross' },
      internalPath: `${rawHome}\\private`,
    }),
    collectLog: () => logFixture(rawLog.replace(rawHome, '~')),
  });

  const created = await service.createDraft({ webContentsId: 17, windowId: 'window-a' });

  assert.equal(created.ok, true);
  assert.equal(created.draft.state, DRAFT_STATE.REVIEWABLE);
  assert.deepEqual(created.draft.available, { screenshot: true, diagnostics: true, log: true });
  const serialized = JSON.stringify(created.draft);
  assert.equal(serialized.includes('private-original-png'), false);
  assert.equal(serialized.includes(SAFE_LOG_TEXT), false);
  assert.equal(serialized.includes('must-never-cross'), false);
  assert.equal(serialized.includes(rawHome), false);
  assert.equal('source' in created.draft, false);
});

test('review model exposes metadata while sender-bound previews return exact safe attachment content', async () => {
  const safeLog = 'INFO user=~ MCP_BEARER_TOKEN=[REDACTED]';
  const service = createService({
    captureScreenshot: () => screenshotFixture(),
    collectDiagnostics: () => diagnosticsFixture({
      environment: { API_KEY: 'raw-api-key' },
      folderList: ['private-folder'],
    }),
    collectLog: () => logFixture(safeLog),
  });
  const draft = await createReviewingDraft(service);

  const result = service.getReview(draft.id, draft.reviewWebContentsId);

  assert.equal(result.ok, true);
  assert.equal(result.draft.state, DRAFT_STATE.REVIEWING);
  const screenshot = result.draft.artifacts.find((artifact) => artifact.kind === ARTIFACT_KIND.SCREENSHOT);
  const log = result.draft.artifacts.find((artifact) => artifact.kind === ARTIFACT_KIND.LOG);
  const diagnostics = result.draft.artifacts.find((artifact) => artifact.kind === ARTIFACT_KIND.DIAGNOSTICS);
  assert.equal('preview' in screenshot, false);
  assert.deepEqual(screenshot.summary, {
    mimeType: 'image/png',
    byteLength: 20,
    width: 1440,
    height: 900,
  });
  assert.deepEqual(log.summary, {
    byteLength: Buffer.byteLength(safeLog),
    truncated: true,
    redactionCount: 1,
  });
  assert.deepEqual(diagnostics.details, {
    capturedAt: '2026-08-06T12:00:00.000Z',
    appName: 'StashBase',
    appVersion: '1.2.3',
    mode: 'Packaged',
    electronVersion: '37.0.0',
    platform: 'win32',
    platformRelease: '10.0.0',
    architecture: 'x64',
  });
  const screenshotPreview = service.getArtifactPreview(
    draft.id, draft.reviewWebContentsId, screenshot.id,
  );
  const logPreview = service.getArtifactPreview(draft.id, draft.reviewWebContentsId, log.id);
  assert.equal(screenshotPreview.ok, true);
  assert.equal(screenshotPreview.preview.mimeType, 'image/png');
  assert.equal(screenshotPreview.preview.width, 1440);
  assert.equal(screenshotPreview.preview.height, 900);
  assert.deepEqual(
    Buffer.from(screenshotPreview.preview.dataUrl.split(',')[1], 'base64'),
    Buffer.from('private-original-png'),
  );
  assert.deepEqual(logPreview.preview, {
    kind: ARTIFACT_KIND.LOG,
    text: safeLog,
    byteLength: Buffer.byteLength(safeLog),
    truncated: true,
    redactionCount: 1,
  });
  const serialized = JSON.stringify({ result, screenshotPreview, logPreview });
  assert.equal(serialized.includes('unredacted-secret'), false);
  assert.equal(serialized.includes('server.log'), false);
  assert.equal(serialized.includes('private-window.png'), false);
  assert.equal(serialized.includes('raw-api-key'), false);
  assert.equal(serialized.includes('private-folder'), false);
  assert.equal(serialized.includes('window-17'), false);
  assert.equal(service.approveDraft(draft.id, draft.reviewWebContentsId).ok, true);
  assert.deepEqual(
    service.getArtifactPreview(draft.id, draft.reviewWebContentsId, screenshot.id),
    screenshotPreview,
  );
  assert.deepEqual(
    service.getArtifactPreview(draft.id, draft.reviewWebContentsId, log.id),
    logPreview,
  );
});

test('draft access is sender-bound and transfers to the bound review window', async () => {
  const service = createService();
  const created = await service.createDraft({ webContentsId: 17, windowId: 'window-a' });

  assert.equal(service.getPreview(created.draft.id, 17).ok, true);
  assert.equal(service.getPreview(created.draft.id, 18).error.code, 'FORBIDDEN');
  assert.equal(service.bindReviewWindow(created.draft.id, 29).ok, true);
  assert.equal(service.getPreview(created.draft.id, 17).error.code, 'FORBIDDEN');
  assert.equal(service.getReview(created.draft.id, 29).ok, true);
  assert.equal(service.bindReviewWindow(created.draft.id, 30).error.code, 'REVIEW_ALREADY_BOUND');
});

test('validated user fields are redacted and persist in the authoritative draft', async () => {
  const service = createService();
  const draft = await createReviewingDraft(service);
  const updated = service.updateDescription(draft.id, draft.reviewWebContentsId, {
    happened: 'Request failed with MCP_BEARER_TOKEN=top-secret',
    expected: 'The request should complete.',
    reproduction: '1. Start StashBase\n2. Retry',
  });

  assert.equal(updated.ok, true);
  assert.equal(updated.draft.description.happened.includes('top-secret'), false);
  assert.match(updated.draft.description.happened, /\[REDACTED\]/);
  assert.deepEqual(service.getReview(draft.id, draft.reviewWebContentsId).draft.description, updated.draft.description);
});

test('description updates reject extra keys, non-string fields, and size violations', async () => {
  const service = createService();
  const draft = await createReviewingDraft(service);
  const valid = { happened: '', expected: '', reproduction: '' };

  assert.equal(service.updateDescription(draft.id, draft.reviewWebContentsId, { ...valid, extra: true }).error.code, 'INVALID_DESCRIPTION');
  assert.equal(service.updateDescription(draft.id, draft.reviewWebContentsId, { ...valid, happened: null }).error.code, 'INVALID_DESCRIPTION');
  assert.equal(service.updateDescription(draft.id, draft.reviewWebContentsId, {
    ...valid,
    happened: 'x'.repeat(MAX_REPORT_FIELD_LENGTH + 1),
  }).error.code, 'INVALID_DESCRIPTION');
});

test('artifact selection changes authoritative state and approval includes only selected artifacts', async () => {
  const service = createService({
    captureScreenshot: () => screenshotFixture(),
    collectDiagnostics: () => diagnosticsFixture(),
    collectLog: () => logFixture(),
  });
  const draft = await createReviewingDraft(service);
  const review = service.getReview(draft.id, draft.reviewWebContentsId).draft;
  const screenshot = review.artifacts.find((artifact) => artifact.kind === ARTIFACT_KIND.SCREENSHOT);
  const log = review.artifacts.find((artifact) => artifact.kind === ARTIFACT_KIND.LOG);

  assert.equal(service.excludeArtifact(draft.id, draft.reviewWebContentsId, screenshot.id).ok, true);
  assert.equal(service.includeArtifact(draft.id, draft.reviewWebContentsId, screenshot.id).ok, true);
  assert.equal(service.excludeArtifact(draft.id, draft.reviewWebContentsId, screenshot.id).ok, true);
  assert.equal(service.excludeArtifact(draft.id, draft.reviewWebContentsId, log.id).ok, true);
  assert.equal(service.includeArtifact(draft.id, draft.reviewWebContentsId, log.id).ok, true);
  const approved = service.approveDraft(draft.id, draft.reviewWebContentsId);

  assert.equal(approved.ok, true);
  assert.equal(approved.report.state, DRAFT_STATE.APPROVED);
  assert.equal(approved.report.artifacts.some((artifact) => artifact.kind === ARTIFACT_KIND.SCREENSHOT), false);
  assert.equal(approved.report.artifacts.some((artifact) => artifact.kind === ARTIFACT_KIND.LOG), true);
  const approvedReview = service.getReview(draft.id, draft.reviewWebContentsId).draft;
  assert.equal(approvedReview.artifacts.some((artifact) => artifact.kind === ARTIFACT_KIND.SCREENSHOT), false);
  assert.equal(approvedReview.artifacts.some((artifact) => artifact.kind === ARTIFACT_KIND.LOG), true);
  assert.equal(
    service.getArtifactPreview(draft.id, draft.reviewWebContentsId, screenshot.id).error.code,
    'INVALID_ARTIFACT',
  );
  assert.equal(service.getArtifactPreview(draft.id, draft.reviewWebContentsId, log.id).ok, true);
});

test('artifact IDs are opaque, draft-owned references and not authorization tokens', async () => {
  const service = createService({ captureScreenshot: () => screenshotFixture() });
  const first = await createReviewingDraft(service, 17, 29);
  const second = await createReviewingDraft(service, 18, 30);
  const firstArtifact = service.getReview(first.id, 29).draft.artifacts[0];

  assert.match(firstArtifact.id, /^artifact-\d+$/);
  assert.equal(service.getArtifactPreview(second.id, 30, firstArtifact.id).error.code, 'INVALID_ARTIFACT');
  assert.equal(service.getArtifactPreview(first.id, 30, firstArtifact.id).error.code, 'FORBIDDEN');
  assert.equal(service.includeArtifact(second.id, 30, firstArtifact.id).error.code, 'INVALID_ARTIFACT');
  assert.equal(service.excludeArtifact(first.id, 30, firstArtifact.id).error.code, 'FORBIDDEN');
  assert.equal(service.excludeArtifact(first.id, 29, 'C:\\Users\\Someone\\file.log').error.code, 'INVALID_ARTIFACT');
});

test('unavailable artifacts cannot be selected', async () => {
  const service = createService();
  const draft = await createReviewingDraft(service);
  const artifacts = service.getReview(draft.id, draft.reviewWebContentsId).draft.artifacts;
  const screenshot = artifacts.find((artifact) => artifact.kind === ARTIFACT_KIND.SCREENSHOT);
  const log = artifacts.find((artifact) => artifact.kind === ARTIFACT_KIND.LOG);

  for (const artifact of [screenshot, log]) {
    assert.equal(artifact.available, false);
    assert.equal(service.includeArtifact(draft.id, draft.reviewWebContentsId, artifact.id).error.code, 'ARTIFACT_UNAVAILABLE');
    assert.equal(service.getArtifactPreview(draft.id, draft.reviewWebContentsId, artifact.id).error.code, 'ARTIFACT_UNAVAILABLE');
  }
});

test('approval requires review authority and is idempotent after explicit approval', async () => {
  const service = createService();
  const created = await service.createDraft({ webContentsId: 17, windowId: 'window-a' });

  assert.equal(service.approveDraft(created.draft.id, 17).error.code, 'FORBIDDEN');
  assert.equal(service.bindReviewWindow(created.draft.id, 29).ok, true);
  const first = service.approveDraft(created.draft.id, 29);
  const repeated = service.approveDraft(created.draft.id, 29);
  assert.equal(first.ok, true);
  assert.equal(first.alreadyApproved, false);
  assert.equal(repeated.ok, true);
  assert.equal(repeated.alreadyApproved, true);
  assert.deepEqual(repeated.report, first.report);
  assert.equal(service.updateDescription(created.draft.id, 29, {
    happened: 'changed', expected: '', reproduction: '',
  }).error.code, 'INVALID_STATE');
});

test('approved handoff claim is immutable, idempotent, and contains only selected main-owned resources', async () => {
  const screenshot = screenshotFixture();
  const service = createService({
    createApprovalId: () => 'approval-one',
    captureScreenshot: () => screenshot,
    collectDiagnostics: () => diagnosticsFixture(),
    collectLog: () => logFixture(),
  });
  const draft = await createReviewingDraft(service);
  const review = service.getReview(draft.id, draft.reviewWebContentsId).draft;
  const screenshotArtifact = review.artifacts.find((artifact) => artifact.kind === ARTIFACT_KIND.SCREENSHOT);
  assert.equal(service.claimApprovedReport(draft.id, draft.reviewWebContentsId).error.code, 'INVALID_STATE');
  assert.equal(service.excludeArtifact(draft.id, draft.reviewWebContentsId, screenshotArtifact.id).ok, true);
  assert.equal(service.approveDraft(draft.id, draft.reviewWebContentsId).ok, true);

  const first = service.claimApprovedReport(draft.id, draft.reviewWebContentsId);
  const repeated = service.claimApprovedReport(draft.id, draft.reviewWebContentsId);

  assert.equal(first.ok, true);
  assert.equal(first.snapshot.approvalId, 'approval-one');
  assert.equal(first.snapshot.artifacts.some((artifact) => artifact.kind === ARTIFACT_KIND.SCREENSHOT), false);
  assert.equal(first.snapshot.artifacts.find((artifact) => artifact.kind === ARTIFACT_KIND.LOG).resource.text, SAFE_LOG_TEXT);
  assert.deepEqual(first.snapshot.artifacts.find((artifact) => artifact.kind === ARTIFACT_KIND.DIAGNOSTICS).resource,
    diagnosticsFixture());
  assert.strictEqual(repeated.snapshot, first.snapshot);
  assert.equal(Object.isFrozen(first.snapshot), true);
  assert.equal(Object.isFrozen(first.snapshot.description), true);
  assert.equal(Object.isFrozen(first.snapshot.artifacts), true);
  assert.equal(Object.isFrozen(first.snapshot.artifacts[0].resource), true);
  assert.equal('id' in first.snapshot.artifacts[0], false);
  assert.equal(JSON.stringify(first.report).includes('approval-one'), false);
});

test('approval rechecks selected content and fails closed if it becomes suspicious', async () => {
  let logScans = 0;
  const service = createService({
    collectLog: () => logFixture(),
    scanText: (text) => {
      if (text === SAFE_LOG_TEXT) {
        logScans += 1;
        return { safe: logScans === 1, categories: [], count: 0 };
      }
      return { safe: true, categories: [], count: 0 };
    },
  });
  const draft = await createReviewingDraft(service);

  assert.equal(service.approveDraft(draft.id, draft.reviewWebContentsId).error.code, 'PRIVACY_CHECK_FAILED');
  assert.equal(service.getReview(draft.id, draft.reviewWebContentsId).draft.state, DRAFT_STATE.REVIEWING);
});

test('unsafe collected logs are unavailable before review and cannot become approved', async () => {
  const unsafe = 'INFO STASHBASE_MCP_BEARER_TOKEN=still-secret';
  const service = createService({ collectLog: () => logFixture(unsafe) });
  const draft = await createReviewingDraft(service);
  const log = service.getReview(draft.id, draft.reviewWebContentsId).draft.artifacts
    .find((artifact) => artifact.kind === ARTIFACT_KIND.LOG);

  assert.equal(log.available, false);
  assert.equal(log.included, false);
  assert.equal(service.includeArtifact(draft.id, draft.reviewWebContentsId, log.id).error.code, 'ARTIFACT_UNAVAILABLE');
  assert.equal(
    service.getArtifactPreview(draft.id, draft.reviewWebContentsId, log.id).error.code,
    'ARTIFACT_UNAVAILABLE',
  );
  const approved = service.approveDraft(draft.id, draft.reviewWebContentsId);
  assert.equal(approved.ok, true);
  assert.equal(approved.report.artifacts.some((artifact) => artifact.kind === ARTIFACT_KIND.LOG), false);
});

test('discarded drafts cannot be approved and repeated discard is safe', async () => {
  const service = createService();
  const draft = await createReviewingDraft(service);

  assert.equal(service.discardDraft(draft.id, draft.reviewWebContentsId).ok, true);
  assert.equal(service.discardDraft(draft.id, draft.reviewWebContentsId).error.code, 'NOT_FOUND');
  assert.equal(service.approveDraft(draft.id, draft.reviewWebContentsId).error.code, 'NOT_FOUND');
});

test('source close preserves bound reviews while review close retires them', async () => {
  const service = createService();
  const unreviewed = await service.createDraft({ webContentsId: 17, windowId: 'window-a' });
  const reviewing = await createReviewingDraft(service, 17, 29);

  assert.equal(service.discardUnreviewedDraftsForSource(17), 1);
  assert.equal(service.getPreview(unreviewed.draft.id, 17).error.code, 'NOT_FOUND');
  assert.equal(service.getReview(reviewing.id, 29).ok, true);
  assert.equal(service.discardDraftsForReviewWindow(29), 1);
  assert.equal(service.getReview(reviewing.id, 29).error.code, 'NOT_FOUND');
});

test('closing a source during collection cannot revive its discarded draft', async () => {
  let finishCapture;
  const capturePending = new Promise((resolve) => { finishCapture = resolve; });
  const service = createService({ captureScreenshot: () => capturePending });
  const creating = service.createDraft({ webContentsId: 17, windowId: 'window-a' });

  assert.equal(service.discardUnreviewedDraftsForSource(17), 1);
  finishCapture(null);
  const created = await creating;
  assert.equal(created.error.code, 'NOT_FOUND');
});

test('collector failures degrade to unavailable artifacts without failing the draft', async () => {
  const service = createService({
    captureScreenshot: () => { throw new Error('capture unavailable'); },
    collectDiagnostics: () => ({ unexpected: 'shape' }),
    collectLog: () => { throw new Error('log unavailable'); },
  });

  const created = await service.createDraft({ webContentsId: 17, windowId: 'window-a' });
  assert.equal(created.ok, true);
  assert.deepEqual(created.draft.available, { screenshot: false, diagnostics: false, log: false });
});

test('partial artifact allocation is retired after an internal creation failure', async () => {
  const artifactIds = ['artifact-a', 'artifact-a', 'artifact-a', 'artifact-b', 'artifact-c'];
  const service = createService({ createArtifactId: () => artifactIds.shift() });

  assert.equal((await service.createDraft({ webContentsId: 17, windowId: 'window-a' })).error.code, 'UNAVAILABLE');
  assert.equal((await service.createDraft({ webContentsId: 17, windowId: 'window-a' })).ok, true);
});

test('invalid identities and references fail with structured errors', async () => {
  const service = createService();
  assert.equal((await service.createDraft({ webContentsId: 0, windowId: 'window-a' })).error.code, 'INVALID_OWNER');
  assert.equal((await service.createDraft({ webContentsId: 17, windowId: '' })).error.code, 'INVALID_OWNER');
  assert.equal(service.getPreview('', 17).error.code, 'INVALID_DRAFT');
  assert.equal(service.getPreview('missing', 17).error.code, 'NOT_FOUND');
  assert.equal(service.bindReviewWindow('missing', 18).error.code, 'NOT_FOUND');
});
