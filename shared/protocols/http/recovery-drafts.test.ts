import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RECOVERY_DRAFT_MAX_CONTENT_BYTES,
  recoveryDraftContentResponseSchema,
  recoveryDraftFailureSchema,
  recoveryDraftIdentitySchema,
  recoveryDraftListResponseSchema,
  recoveryDraftWriteRequestSchema,
  recoveryDraftWriteResponseSchema,
} from './recovery-drafts.ts';

const summary = {
  currentVersion: 'sha256:disk',
  expectedVersion: 'sha256:draft',
  folderPath: '/library/notes',
  path: 'drafts/plan.md',
  savedAt: '2026-09-10T08:00:00.000Z',
};

test('a listing is either the folder drafts or an explicit unavailable reason', () => {
  assert.deepEqual(
    recoveryDraftListResponseSchema.parse({ available: true, drafts: [summary] }),
    { available: true, drafts: [summary] },
  );
  assert.deepEqual(
    recoveryDraftListResponseSchema.parse({ available: false, reason: 'no-key' }),
    { available: false, reason: 'no-key' },
  );
  assert.equal(
    recoveryDraftListResponseSchema.safeParse({ available: false, drafts: [] }).success,
    false,
  );
  assert.equal(
    recoveryDraftListResponseSchema.safeParse({
      available: true,
      drafts: [{ ...summary, content: 'leaked' }],
    }).success,
    false,
    'a listing never carries draft text',
  );
});

test('a summary keeps the version pair and allows a missing source', () => {
  assert.equal(
    recoveryDraftListResponseSchema.safeParse({
      available: true,
      drafts: [{ ...summary, currentVersion: null }],
    }).success,
    true,
  );
  assert.equal(
    recoveryDraftListResponseSchema.safeParse({
      available: true,
      drafts: [{ ...summary, savedAt: 'yesterday' }],
    }).success,
    false,
  );
});

test('draft content and writes are bound to one source and one version', () => {
  assert.deepEqual(
    recoveryDraftContentResponseSchema.parse({ ...summary, content: '# Draft' }),
    { ...summary, content: '# Draft' },
  );
  assert.deepEqual(
    recoveryDraftWriteRequestSchema.parse({
      content: '# Draft',
      expectedVersion: 'sha256:draft',
      folderPath: '/library/notes',
      path: 'drafts/plan.md',
    }),
    {
      content: '# Draft',
      expectedVersion: 'sha256:draft',
      folderPath: '/library/notes',
      path: 'drafts/plan.md',
    },
  );
  assert.equal(
    recoveryDraftWriteRequestSchema.safeParse({
      content: '# Draft',
      folderPath: '/library/notes',
      path: 'drafts/plan.md',
    }).success,
    false,
    'a write without the version it was typed over is refused',
  );
  assert.equal(
    recoveryDraftWriteRequestSchema.safeParse({
      content: 'x'.repeat(RECOVERY_DRAFT_MAX_CONTENT_BYTES + 1),
      expectedVersion: 'sha256:draft',
      folderPath: '/library/notes',
      path: 'drafts/plan.md',
    }).success,
    false,
  );
  assert.equal(
    recoveryDraftIdentitySchema.safeParse({ folderPath: '', path: 'plan.md' }).success,
    false,
  );
  assert.deepEqual(
    recoveryDraftWriteResponseSchema.parse({ savedAt: summary.savedAt }),
    { savedAt: summary.savedAt },
  );
});

test('failures name a bounded code vocabulary', () => {
  assert.deepEqual(
    recoveryDraftFailureSchema.parse({ code: 'RECOVERY_UNAVAILABLE', error: 'no key' }),
    { code: 'RECOVERY_UNAVAILABLE', error: 'no key' },
  );
  assert.equal(
    recoveryDraftFailureSchema.safeParse({ code: 'SOMETHING_ELSE', error: 'x' }).success,
    false,
  );
});
