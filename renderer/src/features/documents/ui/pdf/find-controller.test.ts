import { describe, expect, it } from 'vite-plus/test';

import { foldPdfText, textOffsets } from './find-controller';

describe('PDF Find text matching', () => {
  it('folds common PDF punctuation and spacing variants', () => {
    expect(foldPdfText('“Plan”\u00a0—\u200bready')).toBe('"Plan" - ready');
  });

  it('supports case and whole-word matching', () => {
    expect(
      textOffsets('Plan planner PLAN', 'plan', { caseSensitive: false, wholeWord: true }),
    ).toEqual([0, 13]);
    expect(
      textOffsets('Plan planner PLAN', 'Plan', { caseSensitive: true, wholeWord: false }),
    ).toEqual([0]);
  });
});
