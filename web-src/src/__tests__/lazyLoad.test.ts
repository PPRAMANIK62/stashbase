import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithRetry } from '../components/ErrorBoundary';

test('lazy module loading retries one transient failure', async () => {
  let attempts = 0;
  const loaded = await loadWithRetry(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('temporary chunk failure');
    return 'loaded';
  }, 1, 0);

  assert.equal(loaded, 'loaded');
  assert.equal(attempts, 2);
});

test('lazy module loading surfaces the final error after its retry budget', async () => {
  let attempts = 0;
  await assert.rejects(
    loadWithRetry(async () => {
      attempts += 1;
      throw new Error(`chunk failure ${attempts}`);
    }, 1, 0),
    /chunk failure 2/,
  );
  assert.equal(attempts, 2);
});
