import { describe, expect, it } from 'vite-plus/test';

import {
  exactSearchFileId,
  exactSearchNavigationIntent,
  exactSearchOccurrences,
  exactSearchSegments,
  type ExactSearchFile,
} from './exact-search';

describe('exact search domain', () => {
  const file: ExactSearchFile = {
    id: '/library/research\u0000notes/answer.md',
    matches: [
      {
        line: 7,
        ranges: [
          { end: 10, start: 4 },
          { end: 24, start: 18 },
        ],
        text: 'The answer keeps answer.',
      },
    ],
    source: { folderPath: '/library/research', path: 'notes/answer.md' },
    totalMatches: 1,
  };

  it('keeps source identity folder-qualified for cross-folder results', () => {
    expect(exactSearchFileId(file.source)).toBe('/library/research\u0000notes/answer.md');
    const occurrences = exactSearchOccurrences(file);
    expect(occurrences).toHaveLength(2);
    const second = occurrences[1];
    if (!second) throw new Error('Expected a second occurrence.');
    expect(
      exactSearchNavigationIntent(second, {
        caseSensitive: false,
        query: 'answer',
        wholeWord: false,
      }),
    ).toEqual({
      source: file.source,
      target: {
        caseSensitive: false,
        line: 7,
        occurrenceIndex: 1,
        query: 'answer',
        wholeWord: false,
      },
      type: 'open-search-source',
    });
  });

  it('builds safe highlighted evidence segments from overlapping ranges', () => {
    expect(
      exactSearchSegments('one answer here', [
        { start: 4, end: 10 },
        { start: 8, end: 13 },
      ]),
    ).toEqual([
      { highlighted: false, offset: 0, text: 'one ' },
      { highlighted: true, offset: 4, text: 'answer' },
      { highlighted: true, offset: 10, text: ' he' },
      { highlighted: false, offset: 13, text: 're' },
    ]);
  });
});
