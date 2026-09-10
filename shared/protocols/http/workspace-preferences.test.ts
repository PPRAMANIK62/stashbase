import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  workspacePreferencesRequestSchema,
  workspacePreferencesSchema,
} from './workspace-preferences.ts';

test('the response carries the visibility the server applied', () => {
  assert.deepEqual(workspacePreferencesSchema.parse({ showHiddenFiles: true }), {
    showHiddenFiles: true,
  });
});

test('a response drops a preference this renderer has no reader for', () => {
  assert.deepEqual(
    workspacePreferencesSchema.parse({ showHiddenFiles: false, futurePreference: 1 }),
    { showHiddenFiles: false },
  );
});

test('a response without the applied visibility is refused', () => {
  assert.equal(workspacePreferencesSchema.safeParse({}).success, false);
});

test('a write refuses an unknown key rather than persisting it', () => {
  assert.equal(
    workspacePreferencesRequestSchema.safeParse({ showHiddenFiles: true, rogue: 1 }).success,
    false,
  );
});

test('a write refuses a non-boolean and an empty body', () => {
  assert.equal(workspacePreferencesRequestSchema.safeParse({ showHiddenFiles: 'yes' }).success, false);
  assert.equal(workspacePreferencesRequestSchema.safeParse({}).success, false);
});
