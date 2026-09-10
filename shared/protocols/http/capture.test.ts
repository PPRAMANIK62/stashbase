import assert from 'node:assert/strict';
import test from 'node:test';

import { capturePreferencesRequestSchema, capturePreferencesSchema } from './capture.ts';

test('capture preferences carry the boolean opt-in only', () => {
  assert.equal(capturePreferencesSchema.parse({ clipboardImageImport: false }).clipboardImageImport, false);
  assert.equal(capturePreferencesSchema.safeParse({ clipboardImageImport: 'yes' }).success, false);
  assert.equal(capturePreferencesRequestSchema.safeParse({ clipboardImageImport: true, extra: 1 }).success, false);
});
