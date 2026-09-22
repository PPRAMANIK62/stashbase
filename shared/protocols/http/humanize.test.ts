import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  HUMANIZE_NOTE_LIMIT,
  HUMANIZE_TEXT_LIMIT,
  humanizeRequestSchema,
  humanizeResponseSchema,
} from './humanize.ts';

test('a humanize request is trimmed prose within the service limits and nothing else', () => {
  assert.deepEqual(humanizeRequestSchema.parse({ text: '  A line.  ' }), { text: 'A line.' });
  assert.deepEqual(humanizeRequestSchema.parse({ text: 'A line.', note: ' keep it short ' }), {
    text: 'A line.',
    note: 'keep it short',
  });
  assert.equal(humanizeRequestSchema.safeParse({ text: '   ' }).success, false);
  assert.equal(humanizeRequestSchema.safeParse({ text: 'x'.repeat(HUMANIZE_TEXT_LIMIT) }).success, true);
  assert.equal(humanizeRequestSchema.safeParse({ text: 'x'.repeat(HUMANIZE_TEXT_LIMIT + 1) }).success, false);
  assert.equal(
    humanizeRequestSchema.safeParse({ text: 'A line.', note: 'n'.repeat(HUMANIZE_NOTE_LIMIT + 1) }).success,
    false,
  );
  // The browser never chooses the model or the instruction, and neither does the desktop.
  assert.equal(humanizeRequestSchema.safeParse({ text: 'A line.', model: 'other' }).success, false);
});

test('a humanize response is the rewrite alone', () => {
  assert.deepEqual(humanizeResponseSchema.parse({ text: 'A plain line.', finish: 'stop' }), {
    text: 'A plain line.',
  });
  assert.equal(humanizeResponseSchema.safeParse({ text: '' }).success, false);
});
