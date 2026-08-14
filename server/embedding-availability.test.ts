import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldReconcileAfterEmbeddingSourceChange } from './embedding-availability.ts';

test('switching from exhausted hosted allowance to BYOK always reconciles pending files', () => {
  assert.equal(
    shouldReconcileAfterEmbeddingSourceChange('stashbase-account', 'openai', false),
    true,
  );
  assert.equal(
    shouldReconcileAfterEmbeddingSourceChange('openai', 'openai', false),
    true,
  );
  assert.equal(
    shouldReconcileAfterEmbeddingSourceChange('openai', 'openai', true),
    false,
  );
});
