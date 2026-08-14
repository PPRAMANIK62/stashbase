import assert from 'node:assert/strict';
import test from 'node:test';
import type { EmbedderState } from '../api';
import {
  hasSkippedAiIndexing,
  isEmbeddingAuthorized,
  setAiIndexingSkipped,
} from '../components/embedder/embeddingAuth';

function state(patch: Partial<EmbedderState>): EmbedderState {
  return {
    provider: 'openai',
    hasKey: false,
    authorized: false,
    source: 'openai',
    model: 'text-embedding-3-small',
    account: { signedIn: false, active: false },
    ...patch,
  };
}

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

test('AI Index authorization accepts either hosted account or BYOK source', () => {
  assert.equal(isEmbeddingAuthorized(null), false);
  assert.equal(isEmbeddingAuthorized(state({ authorized: true, source: 'stashbase-account' })), true);
  assert.equal(isEmbeddingAuthorized(state({ authorized: true, source: 'openrouter', hasKey: true })), true);
  assert.equal(isEmbeddingAuthorized(state({ authorized: false, source: 'stashbase-account' })), false);
});
