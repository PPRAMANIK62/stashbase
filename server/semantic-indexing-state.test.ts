import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  clearSemanticIndexingDecision,
  closeStateDb,
  getSemanticIndexingDecision,
  setSemanticIndexingDecision,
} from './state-db.ts';
import { enqueueFolderSyncOperation, runFolderSyncOperation, semanticSyncPolicy } from './state.ts';
import { publishSemanticPause } from './sync.ts';
import type { Indexer } from './indexer.ts';

test('semantic pause is folder-scoped, durable across database reopen, and explicitly recoverable', () => {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-semantic-state-'));
  const previous = process.env.STASHBASE_LOCAL_DATA_ROOT;
  process.env.STASHBASE_LOCAL_DATA_ROOT = dataRoot;
  const first = path.join(dataRoot, 'library-one');
  const second = path.join(dataRoot, 'library-two');
  try {
    setSemanticIndexingDecision(first, 'paused', { sourceCount: 1_200, estimatedBytes: 42 });
    assert.equal(getSemanticIndexingDecision(second), null);
    closeStateDb(); // simulates the process releasing state before restart
    assert.deepEqual(getSemanticIndexingDecision(first), {
      decision: 'paused', sourceCount: 1_200, estimatedBytes: 42,
      updatedAt: getSemanticIndexingDecision(first)?.updatedAt,
    });
    clearSemanticIndexingDecision(first);
    assert.equal(getSemanticIndexingDecision(first), null);
  } finally {
    closeStateDb();
    if (previous == null) delete process.env.STASHBASE_LOCAL_DATA_ROOT;
    else process.env.STASHBASE_LOCAL_DATA_ROOT = previous;
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('resume intent is serialized after an older reconcile can publish its decision', async () => {
  const events: string[] = [];
  let releaseOlder!: () => void;
  const olderGate = new Promise<void>((resolve) => { releaseOlder = resolve; });
  const older = enqueueFolderSyncOperation('folder-race', async () => {
    events.push('older-start');
    await olderGate;
    events.push('older-publish-awaiting');
  });
  const resume = enqueueFolderSyncOperation('folder-race', async () => {
    events.push('resume-clear');
    events.push('resume-embed');
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ['older-start']);
  releaseOlder();
  await Promise.all([older, resume]);
  assert.deepEqual(events, [
    'older-start', 'older-publish-awaiting', 'resume-clear', 'resume-embed',
  ]);
});

test('restart policy reloads pause, invalidates stale work, and resumes only after clear', async () => {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-restart-policy-'));
  const previous = process.env.STASHBASE_LOCAL_DATA_ROOT;
  process.env.STASHBASE_LOCAL_DATA_ROOT = dataRoot;
  const folder = path.join(dataRoot, 'library');
  const workload = { sourceCount: 1_200, estimatedBytes: 120_000_000, large: true };
  try {
    setSemanticIndexingDecision(folder, 'paused', workload);
    closeStateDb();
    const bootPolicy = semanticSyncPolicy(folder);
    assert.equal(bootPolicy.shouldPauseEmbedding(workload), true);
    const deleted: string[] = [];
    assert.equal(await publishSemanticPause(
      { deleteFile: async (source) => { deleted.push(source); } },
      folder, [path.join(folder, 'stale.md')], workload, [], bootPolicy.publishPaused,
    ), true);
    assert.deepEqual(deleted, [path.join(folder, 'stale.md')]);
    assert.equal(getSemanticIndexingDecision(folder)?.decision, 'paused');

    const resumePolicy = semanticSyncPolicy(folder, true);
    assert.equal(clearSemanticIndexingDecision(folder), true);
    assert.equal(resumePolicy.shouldPauseEmbedding(workload), false);
    assert.equal(resumePolicy.commitEmbedding(), true);
    assert.equal(getSemanticIndexingDecision(folder), null);
  } finally {
    closeStateDb();
    if (previous == null) delete process.env.STASHBASE_LOCAL_DATA_ROOT;
    else process.env.STASHBASE_LOCAL_DATA_ROOT = previous;
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('actual queued startup sync honors a restored pause and forced resume embeds', async () => {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-restart-sync-'));
  const previous = process.env.STASHBASE_LOCAL_DATA_ROOT;
  process.env.STASHBASE_LOCAL_DATA_ROOT = dataRoot;
  const folder = path.join(dataRoot, 'library');
  fs.mkdirSync(folder, { recursive: true });
  const source = path.join(folder, 'changed.md');
  fs.writeFileSync(source, 'replacement content');
  const events: string[] = [];
  const mockIndexer = {
    syncDiff: async () => ({ added: [], modified: [source], deleted: [], renamed: [] }),
    listFiles: async () => ({ [source]: 'old-hash' }),
    deleteFile: async (path: string) => { events.push(`delete:${path}`); },
    upsertFile: async (path: string) => { events.push(`upsert:${path}`); return 1; },
    status: async () => ({ pending: [], total: 1, indexed: 1, pendingCount: 0, orphanedCount: 0, orphaned: [], upToDate: true }),
  } as unknown as Indexer;
  const deps = {
    indexer: mockIndexer,
    bind: async () => { events.push('bind'); },
    sync: (await import('./sync.ts')).syncIndex,
    semanticEnabled: true,
  };
  try {
    setSemanticIndexingDecision(folder, 'paused', { sourceCount: 1, estimatedBytes: 10 });
    closeStateDb();
    const boot = await runFolderSyncOperation(folder, { reason: 'app boot' }, deps);
    assert.equal(boot.semanticPaused, true);
    assert.deepEqual(events, ['bind', `delete:${source}`]);
    assert.equal(getSemanticIndexingDecision(folder)?.decision, 'paused');

    events.length = 0;
    const resumed = await runFolderSyncOperation(folder, {
      reason: 'user started semantic indexing', forceEmbedding: true, clearDecisionAtStart: true,
    }, deps);
    assert.equal(resumed.semanticPaused, undefined);
    assert.deepEqual(events, ['bind', `upsert:${source}`]);
    assert.equal(getSemanticIndexingDecision(folder), null);
  } finally {
    closeStateDb();
    if (previous == null) delete process.env.STASHBASE_LOCAL_DATA_ROOT;
    else process.env.STASHBASE_LOCAL_DATA_ROOT = previous;
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});
