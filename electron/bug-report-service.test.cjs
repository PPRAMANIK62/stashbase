'use strict';

console.log("Report-Serivce Testing");

const assert = require('node:assert/strict');
const test = require('node:test');
const { DRAFT_STATE, createBugReportService } = require('./bug-report-service.cjs');

function createService() {
  let nextId = 0;
  let clock = Date.parse('2026-08-06T12:00:00.000Z');
  return createBugReportService({
    createId: () => `draft-${++nextId}`,
    now: () => clock++,
  });
}

test('drafts are main-process records and renderer snapshots contain only safe metadata', () => {
  const service = createService();
  const created = service.createDraft({ webContentsId: 17, windowId: 'window-a' });

  assert.equal(created.ok, true);
  assert.deepEqual(created.draft, {
    id: 'draft-1',
    state: DRAFT_STATE.DRAFT,
    createdAt: '2026-08-06T12:00:00.000Z',
    updatedAt: '2026-08-06T12:00:00.000Z',
    available: {
      screenshot: false,
      diagnostics: false,
      log: false,
      reportMetadata: false,
    },
  });
  assert.equal('source' in created.draft, false);
  assert.equal('reviewWebContentsId' in created.draft, false);

  created.draft.state = 'tampered';
  const preview = service.getPreview('draft-1', 17);
  assert.equal(preview.ok, true);
  assert.equal(preview.draft.state, DRAFT_STATE.DRAFT);
});

test('draft access is bound to the main-process-derived sender identity, not ID secrecy', () => {
  const service = createService();
  const created = service.createDraft({ webContentsId: 17, windowId: 'window-a' });

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

test('binding a review window transfers renderer access without exposing internal ownership', () => {
  const service = createService();
  const created = service.createDraft({ webContentsId: 17, windowId: 'window-a' });
  const bound = service.bindReviewWindow(created.draft.id, 29);

  assert.equal(bound.ok, true);
  assert.equal(bound.draft.state, DRAFT_STATE.REVIEWING);
  assert.equal(service.getPreview(created.draft.id, 17).error.code, 'FORBIDDEN');
  assert.equal(service.getPreview(created.draft.id, 29).ok, true);
  assert.equal(service.bindReviewWindow(created.draft.id, 30).error.code, 'REVIEW_ALREADY_BOUND');
});

test('retiring a source window discards only unreviewed drafts', () => {
  const service = createService();
  const unreviewed = service.createDraft({ webContentsId: 17, windowId: 'window-a' }).draft;
  const reviewing = service.createDraft({ webContentsId: 17, windowId: 'window-a' }).draft;
  assert.equal(service.bindReviewWindow(reviewing.id, 29).ok, true);

  assert.equal(service.discardUnreviewedDraftsForSource(17), 1);
  assert.equal(service.getPreview(unreviewed.id, 17).error.code, 'NOT_FOUND');
  assert.equal(service.getPreview(reviewing.id, 29).ok, true);
  assert.equal(service.discardDraftsForReviewWindow(29), 1);
  assert.equal(service.getPreview(reviewing.id, 29).error.code, 'NOT_FOUND');
});

test('invalid source identities and draft references fail without throwing or leaking internals', () => {
  const service = createService();
  assert.equal(service.createDraft({ webContentsId: 0, windowId: 'window-a' }).error.code, 'INVALID_OWNER');
  assert.equal(service.createDraft({ webContentsId: 17, windowId: '' }).error.code, 'INVALID_OWNER');
  assert.equal(service.getPreview('', 17).error.code, 'INVALID_DRAFT');
  assert.equal(service.getPreview('missing', 17).error.code, 'NOT_FOUND');
  assert.equal(service.bindReviewWindow('missing', 18).error.code, 'NOT_FOUND');
});

test('internal draft creation failures become structured public errors', () => {
  const unavailable = createBugReportService({
    createId: () => { throw new Error('random source failed'); },
  });

  assert.deepEqual(unavailable.createDraft({ webContentsId: 17, windowId: 'window-a' }), {
    ok: false,
    error: {
      code: 'UNAVAILABLE',
      message: 'The bug report service is temporarily unavailable.',
    },
  });
});
