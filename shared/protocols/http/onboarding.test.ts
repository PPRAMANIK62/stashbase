import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  onboardingPreferencesRequestSchema,
  onboardingPreferencesSchema,
} from './onboarding.ts';

test('onboarding preferences read as an empty set before any notice is answered', () => {
  assert.deepEqual(onboardingPreferencesSchema.parse({}), {});
});

test('onboarding preferences carry each answered notice revision', () => {
  assert.deepEqual(
    onboardingPreferencesSchema.parse({
      searchSetupInvitationVersion: 1,
      sourceCodeNoticeVersion: 2,
    }),
    { searchSetupInvitationVersion: 1, sourceCodeNoticeVersion: 2 },
  );
});

test('a read drops a notice this renderer has no reader for', () => {
  assert.deepEqual(
    onboardingPreferencesSchema.parse({ searchSetupInvitationVersion: 1, futureNotice: 3 }),
    { searchSetupInvitationVersion: 1 },
  );
});

test('a read refuses a revision that is not a whole count', () => {
  for (const bad of [-1, 1.5, '1', null]) {
    assert.equal(
      onboardingPreferencesSchema.safeParse({ searchSetupInvitationVersion: bad }).success,
      false,
    );
  }
});

test('a write refuses an unknown key rather than persisting it', () => {
  assert.equal(
    onboardingPreferencesRequestSchema.safeParse({ searchSetupInvitationVersion: 1, other: 1 })
      .success,
    false,
  );
});

test('a write refuses an empty patch', () => {
  assert.equal(onboardingPreferencesRequestSchema.safeParse({}).success, false);
});

test('a write accepts one notice on its own', () => {
  assert.deepEqual(onboardingPreferencesRequestSchema.parse({ searchSetupInvitationVersion: 1 }), {
    searchSetupInvitationVersion: 1,
  });
});
