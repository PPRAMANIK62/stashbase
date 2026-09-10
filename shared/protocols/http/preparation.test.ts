import assert from 'node:assert/strict';
import test from 'node:test';

import {
  preparationCancelResponseSchema,
  preparationReprocessRequestSchema,
  preparationReprocessResponseSchema,
} from './preparation.ts';

test('reprocess carries an explicit folder and an optional media language', () => {
  assert.equal(
    preparationReprocessRequestSchema.safeParse({
      folder: '/library/research',
      language: 'en',
      path: 'talks/keynote.mp3',
    }).success,
    true,
  );
  assert.equal(
    preparationReprocessRequestSchema.safeParse({ path: 'talks/keynote.mp3' }).success,
    false,
  );
});

test('control responses distinguish the reprocess mode and the cancel outcome', () => {
  assert.equal(
    preparationReprocessResponseSchema.parse({ mode: 'conversion', ok: true }).mode,
    'conversion',
  );
  assert.equal(preparationReprocessResponseSchema.safeParse({ mode: 'retry', ok: true }).success, false);
  assert.equal(preparationCancelResponseSchema.parse({ cancelled: false, ok: true }).cancelled, false);
});
