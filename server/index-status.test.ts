import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {
  conversionProgressForFolder,
  conversionVersionsForFolder,
  semanticIndexingState,
} from './index-status.ts';

test('index status conversion maps are scoped and folder-relative', () => {
  const root = path.resolve('/tmp/stashbase-index-status');
  const inside = path.join(root, 'docs', 'paper.pdf');
  const outside = path.resolve('/tmp/other/paper.pdf');
  const snapshot = {
    revision: 7,
    tasks: [
      { key: inside, state: 'queued', lane: 'heavy', tasksAhead: 2 },
      { key: path.join(root, 'recordings', 'meeting.wav'), state: 'yielded', lane: 'heavy', tasksAhead: 1 },
      { key: outside, state: 'queued', lane: 'heavy', tasksAhead: 0 },
    ],
    versions: {
      [inside]: 11,
      [outside]: 99,
    },
  };

  assert.deepEqual(conversionProgressForFolder(root, snapshot as any), {
    'docs/paper.pdf': { phase: 'queued', lane: 'heavy', tasksAhead: 2 },
    'recordings/meeting.wav': { phase: 'yielded', lane: 'heavy', tasksAhead: 1 },
  });
  assert.deepEqual(conversionVersionsForFolder(root, snapshot as any), {
    'docs/paper.pdf': 11,
  });
});

test('semantic status distinguishes disabled, partial, paused, ready, and failed', () => {
  assert.equal(semanticIndexingState({ enabled: false, decision: null, indexed: 0, pending: 3, failed: false }), 'disabled');
  assert.equal(semanticIndexingState({ enabled: true, decision: 'awaiting-decision', indexed: 2, pending: 3, failed: false }), 'awaiting-decision');
  assert.equal(semanticIndexingState({ enabled: true, decision: 'paused', indexed: 2, pending: 3, failed: false }), 'partial-paused');
  assert.equal(semanticIndexingState({ enabled: true, decision: 'paused', indexed: 2, pending: 3, failed: true }), 'partial-paused');
  assert.equal(semanticIndexingState({ enabled: true, decision: null, indexed: 2, pending: 3, failed: false }), 'partial-indexing');
  assert.equal(semanticIndexingState({ enabled: true, decision: null, indexed: 2, pending: 0, failed: false }), 'ready');
  assert.equal(semanticIndexingState({ enabled: true, decision: null, indexed: 2, pending: 0, failed: true }), 'failed');
});
