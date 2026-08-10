import assert from 'node:assert/strict';
import test from 'node:test';

import { guiSemanticVisibleCount } from '../store/appContextHelpers.ts';
import type { SearchHit } from '../api';

function hits(...scores: number[]): SearchHit[] {
  return scores.map((score, i) => ({
    fileName: `f${i}.md`, chunkIndex: 0, content: '', heading: '', score,
  }));
}

test('empty and single result sets return their own length', () => {
  assert.equal(guiSemanticVisibleCount(hits()), 0);
  assert.equal(guiSemanticVisibleCount(hits(0.03)), 1);
});

test('a smooth score curve shows up to the visible cap, never discarding candidates', () => {
  // Twelve gently-declining scores: the knee never trips, so the initial
  // count is capped at 8 while the full 12 remain available to reveal.
  const smooth = hits(...Array.from({ length: 12 }, (_, i) => 1 - i * 0.01));
  assert.equal(guiSemanticVisibleCount(smooth), 8);
});

test('a sharp relevance drop pulls the initial count back to the knee', () => {
  // Three strong matches, then a cliff: only the strong ones show first.
  assert.equal(guiSemanticVisibleCount(hits(0.9, 0.88, 0.86, 0.2, 0.19, 0.18)), 3);
});

test('non-finite or non-positive top score falls back to the visible cap', () => {
  assert.equal(guiSemanticVisibleCount(hits(0, 0, 0, 0, 0, 0, 0, 0, 0, 0)), 8);
  assert.equal(guiSemanticVisibleCount(hits(Number.NaN, 0.5)), 2);
});

test('the count never exceeds the number of fetched hits', () => {
  assert.equal(guiSemanticVisibleCount(hits(0.9, 0.89)), 2);
});
