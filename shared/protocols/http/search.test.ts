import assert from 'node:assert/strict';
import test from 'node:test';

import { exactSearchRequestSchema, exactSearchResponseSchema } from './search.ts';

test('exact search accepts folder-qualified source evidence', () => {
  assert.equal(
    exactSearchResponseSchema.parse({
      files: [
        {
          folder: '/library/research',
          matches: [
            {
              audioTimestampMs: 12_500,
              line: 7,
              ranges: [[4, 10]],
              text: 'The exact answer is here.',
            },
          ],
          path: 'notes/answer.md',
          totalMatches: 1,
        },
      ],
      totalMatches: 1,
      truncated: false,
    }).files[0]?.folder,
    '/library/research',
  );
});

test('exact search requires a complete bounded request and ordered match ranges', () => {
  assert.equal(
    exactSearchRequestSchema.safeParse({
      case_strict: false,
      query: 'answer',
      whole_word: false,
    }).success,
    true,
  );
  assert.equal(
    exactSearchResponseSchema.safeParse({
      files: [
        {
          folder: '/library/research',
          matches: [{ line: 1, ranges: [[8, 2]], text: 'answer' }],
          path: 'answer.md',
          totalMatches: 1,
        },
      ],
      totalMatches: 1,
      truncated: false,
    }).success,
    false,
  );
});
