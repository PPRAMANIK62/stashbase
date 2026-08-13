import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasSkippedAiIndexing,
  isEmbeddingAuthorized,
  setAiIndexingSkipped,
} from '../components/embedder/embeddingAuth';

test('the AI Index skip is per folder: another folder re-offers, activation clears all', () => {
  assert.equal(hasSkippedAiIndexing('/work/alpha'), false);

  // Skipping alpha quiets alpha only — switching to beta must re-offer
  // (the titlebar switcher made in-place switching the primary flow, so a
  // window-wide skip silently became a permanent opt-out).
  setAiIndexingSkipped(true, '/work/alpha');
  assert.equal(hasSkippedAiIndexing('/work/alpha'), true);
  assert.equal(hasSkippedAiIndexing('/work/beta'), false);

  // Returning to a folder skipped in this window stays quiet.
  setAiIndexingSkipped(true, '/work/beta');
  assert.equal(hasSkippedAiIndexing('/work/alpha'), true);
  assert.equal(hasSkippedAiIndexing('/work/beta'), true);

  // Activation clears every prior skip, so a later key removal re-gates
  // from a clean state instead of staying silently skipped.
  setAiIndexingSkipped(false, '/work/alpha');
  assert.equal(hasSkippedAiIndexing('/work/alpha'), false);
  assert.equal(hasSkippedAiIndexing('/work/beta'), false);
});

test('authorization is the stored key, not login state', () => {
  assert.equal(isEmbeddingAuthorized(null), false);
  assert.equal(isEmbeddingAuthorized({ hasKey: false } as never), false);
  assert.equal(isEmbeddingAuthorized({ hasKey: true } as never), true);
});
