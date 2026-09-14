import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldReconcileAfterEmbeddingSourceChange } from './embedding-availability.ts';

test('changing or restoring a BYOK source reconciles pending files', () => {
  assert.equal(
    shouldReconcileAfterEmbeddingSourceChange('openrouter', 'openai', true),
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
