'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { DRAFT_STATE, createBugReportService } = require('./bug-report-service.cjs');

function createService(overrides = {}) {
  let nextId = 0;
  let clock = Date.parse('2026-08-06T12:00:00.000Z');
  return createBugReportService({
    createId: () => `draft-${++nextId}`,
    now: () => clock++,
    ...overrides,
  });
}

function safeEmptyCollection() {
  return {
    screenshot: { available: false },
    diagnostics: null,
    log: { available: false },
  };
}

test('drafts are main-process records and renderer snapshots contain only safe report data', async () => {
  const service = createService();
  const created = await service.createDraft({ webContentsId: 17, windowId: 'window-a' });

  assert.equal(created.ok, true);
  assert.deepEqual(created.draft, {
    id: 'draft-1',
    state: DRAFT_STATE.DRAFT,
    createdAt: '2026-08-06T12:00:00.000Z',
    updatedAt: '2026-08-06T12:00:00.001Z',
    available: {
      screenshot: false,
      diagnostics: false,
      log: false,
      reportMetadata: false,
    },
    collection: safeEmptyCollection(),
  });
  assert.equal('source' in created.draft, false);
  assert.equal('reviewWebContentsId' in created.draft, false);

  created.draft.state = 'tampered';
  const preview = service.getPreview('draft-1', 17);
  assert.equal(preview.ok, true);
  assert.equal(preview.draft.state, DRAFT_STATE.DRAFT);
});

test('draft access is bound to the main-process-derived sender identity, not ID secrecy', async () => {
  const service = createService();
  const created = await service.createDraft({ webContentsId: 17, windowId: 'window-a' });

  assert.equal(service.getPreview(created.draft.id, 17).ok, true);
  assert.deepEqual(service.getPreview(created.draft.id, 18), {
    ok: false,
    error: {
      code: 'FORBIDDEN',
      message: 'This window cannot access that bug report draft.',
    },
  });
  assert.deepEqual(service.discardDraft(created.draft.id, 18), {
    ok: false,
    error: {
      code: 'FORBIDDEN',
      message: 'This window cannot access that bug report draft.',
    },
  });
  assert.equal(service.getPreview(created.draft.id, 17).ok, true);
});

test('binding a review window transfers renderer access without exposing internal ownership', async () => {
  const service = createService();
  const created = await service.createDraft({ webContentsId: 17, windowId: 'window-a' });
  const bound = service.bindReviewWindow(created.draft.id, 29);

  assert.equal(bound.ok, true);
  assert.equal(bound.draft.state, DRAFT_STATE.REVIEWING);
  assert.equal(service.getPreview(created.draft.id, 17).error.code, 'FORBIDDEN');
  assert.equal(service.getPreview(created.draft.id, 29).ok, true);
  assert.equal(service.bindReviewWindow(created.draft.id, 30).error.code, 'REVIEW_ALREADY_BOUND');
});

test('retiring source and review windows follows the ownership lifecycle', async () => {
  const service = createService();
  const unreviewed = (await service.createDraft({ webContentsId: 17, windowId: 'window-a' })).draft;
  const reviewing = (await service.createDraft({ webContentsId: 17, windowId: 'window-a' })).draft;
  assert.equal(service.bindReviewWindow(reviewing.id, 29).ok, true);

  assert.equal(service.discardUnreviewedDraftsForSource(17), 1);
  assert.equal(service.getPreview(unreviewed.id, 17).error.code, 'NOT_FOUND');
  assert.equal(service.getPreview(reviewing.id, 29).ok, true);
  assert.equal(service.discardDraftsForReviewWindow(29), 1);
  assert.equal(service.getPreview(reviewing.id, 29).error.code, 'NOT_FOUND');
});

test('closing a source during collection cannot revive its discarded draft', async () => {
  let finishCapture;
  const capturePending = new Promise((resolve) => { finishCapture = resolve; });
  const service = createService({ captureScreenshot: () => capturePending });
  const creating = service.createDraft({ webContentsId: 17, windowId: 'window-a' });

  assert.equal(service.discardUnreviewedDraftsForSource(17), 1);
  finishCapture(null);
  const created = await creating;
  assert.equal(created.ok, false);
  assert.equal(created.error.code, 'NOT_FOUND');
});

test('invalid source identities and draft references fail without throwing or leaking internals', async () => {
  const service = createService();
  assert.equal((await service.createDraft({ webContentsId: 0, windowId: 'window-a' })).error.code, 'INVALID_OWNER');
  assert.equal((await service.createDraft({ webContentsId: 17, windowId: '' })).error.code, 'INVALID_OWNER');
  assert.equal(service.getPreview('', 17).error.code, 'INVALID_DRAFT');
  assert.equal(service.getPreview('missing', 17).error.code, 'NOT_FOUND');
  assert.equal(service.bindReviewWindow('missing', 18).error.code, 'NOT_FOUND');
});

test('internal draft creation failures become structured public errors', async () => {
  const unavailable = createBugReportService({
    createId: () => { throw new Error('random source failed'); },
  });

  assert.deepEqual(await unavailable.createDraft({ webContentsId: 17, windowId: 'window-a' }), {
    ok: false,
    error: {
      code: 'UNAVAILABLE',
      message: 'The bug report service is temporarily unavailable.',
    },
  });
});

test('collector failures degrade to unavailable resources without failing the draft', async () => {
  const service = createService({
    captureScreenshot: () => { throw new Error('capture unavailable'); },
    collectDiagnostics: () => ({ unexpected: 'shape' }),
    collectLog: () => { throw new Error('log unavailable'); },
  });

  const created = await service.createDraft({ webContentsId: 17, windowId: 'window-a' });
  assert.equal(created.ok, true);
  assert.deepEqual(created.draft.collection, safeEmptyCollection());
});

test('fail-closed scan rejects suspicious post-redaction log output before preview', async () => {
  const unsafeText = 'INFO STASHBASE_MCP_BEARER_TOKEN=still-secret';
  const service = createService({
    collectLog: () => ({
      text: unsafeText,
      byteLength: Buffer.byteLength(unsafeText),
      truncated: false,
      redactionCount: 1,
    }),
  });

  const created = await service.createDraft({ webContentsId: 17, windowId: 'window-a' });
  assert.equal(created.ok, true);
  assert.equal(created.draft.available.log, false);
  assert.deepEqual(created.draft.collection.log, { available: false });
});

test('safe post-redaction log output may proceed without exposing its contents', async () => {
  const safeText = 'INFO STASHBASE_MCP_BEARER_TOKEN=[REDACTED]';
  const service = createService({
    collectLog: () => ({
      text: safeText,
      byteLength: Buffer.byteLength(safeText),
      truncated: true,
      redactionCount: 1,
    }),
  });

  const created = await service.createDraft({ webContentsId: 17, windowId: 'window-a' });
  assert.equal(created.ok, true);
  assert.equal(created.draft.available.log, true);
  assert.deepEqual(created.draft.collection.log, {
    available: true,
    byteLength: Buffer.byteLength(safeText),
    truncated: true,
    redactionCount: 1,
  });
  assert.equal(JSON.stringify(created.draft).includes(safeText), false);
});
