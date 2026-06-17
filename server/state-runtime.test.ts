import assert from 'node:assert/strict';
import test from 'node:test';
import {
  __claimStaleLockSweepForTest,
  __spaceSyncGenerationForTest,
  __spaceSyncShouldContinueForTest,
  __setSpaceWarningsForTest,
  deleteSpaceRuntimeState,
  getIndexWarning,
  getSnapshotWarning,
  invalidateSpaceSync,
  renameSpaceRuntimeState,
} from './state.ts';

test('stale lock sweep is claimed once per KB root', () => {
  assert.equal(__claimStaleLockSweepForTest('/tmp/stashbase-root-a'), true);
  assert.equal(__claimStaleLockSweepForTest('/tmp/stashbase-root-a'), false);
  assert.equal(__claimStaleLockSweepForTest('/tmp/stashbase-root-b'), true);
});

test('renameSpaceRuntimeState moves in-memory warnings to the new space name', async () => {
  const snapshot = {
    skipped: 3,
    details: [{ provider: 'openai_1536', chunks: 3 }],
    at: '2026-01-01T00:00:00.000Z',
  };
  const index = {
    message: '2 files failed',
    at: '2026-01-01T00:00:01.000Z',
  };
  __setSpaceWarningsForTest('Old', { snapshot, index });

  await renameSpaceRuntimeState('Old', 'New');

  assert.equal(getSnapshotWarning('Old'), null);
  assert.equal(getIndexWarning('Old'), null);
  assert.deepEqual(getSnapshotWarning('New'), snapshot);
  assert.deepEqual(getIndexWarning('New'), index);
});

test('deleteSpaceRuntimeState clears in-memory warnings for the deleted space', async () => {
  __setSpaceWarningsForTest('Gone', {
    snapshot: {
      skipped: 1,
      details: [{ provider: 'openai_1536', chunks: 1 }],
      at: '2026-01-01T00:00:00.000Z',
    },
    index: {
      message: 'failed',
      at: '2026-01-01T00:00:01.000Z',
    },
  });

  await deleteSpaceRuntimeState('Gone');

  assert.equal(getSnapshotWarning('Gone'), null);
  assert.equal(getIndexWarning('Gone'), null);
});

test('invalidateSpaceSync cancels stale space sync generations', () => {
  const before = __spaceSyncGenerationForTest('Project');

  assert.equal(__spaceSyncShouldContinueForTest('Project', before), true);

  invalidateSpaceSync('Project');

  assert.equal(__spaceSyncShouldContinueForTest('Project', before), false);
  assert.equal(
    __spaceSyncShouldContinueForTest('Project', __spaceSyncGenerationForTest('Project'), () => false),
    false,
  );
});
