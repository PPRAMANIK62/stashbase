import assert from 'node:assert/strict';
import { test } from 'node:test';

import { galleryEntrySchema, galleryIndexSchema } from './gallery.ts';

const ENTRY = {
  category: 'course',
  contents: '20 transcripts',
  description: 'A course.',
  id: 'cs183b',
  name: 'How to Start a Startup',
  repo: 'https://github.com/owner/repo',
};

test('carries an entry that publishes only its required fields', () => {
  const parsed = galleryEntrySchema.parse(ENTRY);
  assert.deepEqual(parsed.starterPrompts, []);
  assert.equal(parsed.files, undefined);
  assert.equal(parsed.screenshots, undefined);
  assert.equal(parsed.wikiPrompt, undefined);
});

test('ignores a field a newer gallery publishes', () => {
  // Additive-only: an index published by a newer gallery must still read here,
  // or shipping one field would break every older build.
  const parsed = galleryEntrySchema.parse({ ...ENTRY, difficulty: 'beginner' });
  assert.equal('difficulty' in parsed, false);
});

test('refuses a schema version this build does not understand', () => {
  // Whole-or-nothing: the caller falls back to the bundled snapshot, and a
  // half-read shop is worse than a slightly stale one. The second case is the
  // route's own offline envelope, which is a 200 by design.
  assert.equal(galleryIndexSchema.safeParse({ schemaVersion: 2, wikis: [] }).success, false);
  assert.equal(
    galleryIndexSchema.safeParse({ error: 'offline', schemaVersion: 0 }).success,
    false,
  );
  assert.equal(galleryIndexSchema.safeParse({ schemaVersion: 1, wikis: [ENTRY] }).success, true);
});

test('refuses the whole index when one entry is unusable', () => {
  // One unusable entry means the publication is wrong; showing the rest would
  // hide that from the publisher as well as the reader.
  const index = galleryIndexSchema.safeParse({
    schemaVersion: 1,
    wikis: [ENTRY, { ...ENTRY, id: '   ' }],
  });
  assert.equal(index.success, false);
});
