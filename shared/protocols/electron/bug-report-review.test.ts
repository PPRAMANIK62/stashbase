import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BUG_REPORT_REVIEW_CHANNEL,
  bugReportArtifactPreviewResponseSchema,
  bugReportArtifactIdSchema,
  bugReportDescriptionSchema,
  bugReportPrepareResponseSchema,
  bugReportReviewDraftResponseSchema,
} from './bug-report-review.ts';

const approval = {
  approvedAt: '2026-09-09T00:00:00.000Z',
  artifacts: [{ id: 'a1', kind: 'screenshot' }],
  description: { problem: 'It broke', reproduction: '' },
  state: 'approved',
};

const draft = {
  approval: null,
  artifacts: [
    {
      available: true,
      id: 'a1',
      included: true,
      kind: 'screenshot',
      summary: { byteLength: 10, height: 2, mimeType: 'image/png', width: 2 },
    },
    { available: false, id: 'a2', included: false, kind: 'log' },
    {
      available: true,
      details: {
        appName: 'StashBase',
        appVersion: '1.0.0',
        architecture: 'x64',
        capturedAt: '2026-09-09T00:00:00.000Z',
        electronVersion: '38.0.0',
        mode: 'Development',
        platform: 'linux',
        platformRelease: '7.1',
      },
      id: 'a3',
      included: true,
      kind: 'diagnostics',
    },
  ],
  createdAt: '2026-09-09T00:00:00.000Z',
  description: { problem: '', reproduction: '' },
  state: 'reviewing',
  updatedAt: '2026-09-09T00:00:00.000Z',
};

test('the review channel set is exactly the ten sender-bound operations', () => {
  assert.deepEqual([...Object.keys(BUG_REPORT_REVIEW_CHANNEL)].sort(), [
    'DISCARD',
    'EXCLUDE_ARTIFACT',
    'GET',
    'GET_ARTIFACT_PREVIEW',
    'INCLUDE_ARTIFACT',
    'OPEN_GITHUB',
    'PREPARE',
    'REOPEN',
    'SAVE_ARTIFACTS',
    'UPDATE_DESCRIPTION',
  ]);
  assert.ok(Object.values(BUG_REPORT_REVIEW_CHANNEL).every((c) => c.startsWith('bug-report-review:')));
});

test('the review model accepts the service shape and rejects extra or missing fields', () => {
  assert.equal(bugReportReviewDraftResponseSchema.safeParse({ draft, ok: true }).success, true);
  assert.equal(
    bugReportReviewDraftResponseSchema.safeParse({ draft: { ...draft, path: '/tmp/x' }, ok: true })
      .success,
    false,
  );
  assert.equal(
    bugReportReviewDraftResponseSchema.safeParse({
      error: { code: 'NOT_FOUND', message: 'The bug report draft is no longer available.' },
      ok: false,
    }).success,
    true,
  );
  assert.equal(
    bugReportReviewDraftResponseSchema.safeParse({
      error: { code: 'SOMETHING_ELSE', message: 'x' },
      ok: false,
    }).success,
    false,
  );
});

test('requests carry only an artifact id or the two description fields', () => {
  assert.equal(bugReportArtifactIdSchema.safeParse('a1').success, true);
  assert.equal(bugReportArtifactIdSchema.safeParse('').success, false);
  assert.equal(bugReportArtifactIdSchema.safeParse({ artifactId: 'a1' }).success, false);
  assert.equal(
    bugReportDescriptionSchema.safeParse({ problem: 'p', reproduction: 'r' }).success,
    true,
  );
  assert.equal(
    bugReportDescriptionSchema.safeParse({ problem: 'p', reproduction: 'r', extra: 1 }).success,
    false,
  );
  assert.equal(
    bugReportDescriptionSchema.safeParse({ problem: 'x'.repeat(12_001), reproduction: '' })
      .success,
    false,
  );
});

test('previews are a PNG data URL, sanitized text, or fixed diagnostics only', () => {
  assert.equal(
    bugReportArtifactPreviewResponseSchema.safeParse({
      ok: true,
      preview: {
        byteLength: 4,
        dataUrl: 'data:image/png;base64,AAAA',
        height: 1,
        kind: 'screenshot',
        mimeType: 'image/png',
        width: 1,
      },
    }).success,
    true,
  );
  assert.equal(
    bugReportArtifactPreviewResponseSchema.safeParse({
      ok: true,
      preview: {
        byteLength: 4,
        dataUrl: 'data:text/html;base64,AAAA',
        height: 1,
        kind: 'screenshot',
        mimeType: 'image/png',
        width: 1,
      },
    }).success,
    false,
  );
  assert.equal(
    bugReportArtifactPreviewResponseSchema.safeParse({
      ok: true,
      preview: { byteLength: 3, kind: 'log', redactionCount: 0, text: 'abc', truncated: false },
    }).success,
    true,
  );
});

test('prepare distinguishes a prepared report from an approved one whose files failed', () => {
  assert.equal(
    bugReportPrepareResponseSchema.safeParse({
      ok: true,
      prepared: { artifactCount: 1 },
      report: approval,
    }).success,
    true,
  );
  const approvedButUnprepared = bugReportPrepareResponseSchema.safeParse({
    error: { code: 'PREPARE_FAILED', message: 'The report files could not be prepared.' },
    ok: false,
    report: approval,
  });
  assert.equal(approvedButUnprepared.success, true);
  assert.equal(
    bugReportPrepareResponseSchema.safeParse({
      error: { code: 'PRIVACY_CHECK_FAILED', message: 'Potentially sensitive content.' },
      ok: false,
    }).success,
    true,
  );
});
