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
import {
  cancelFolderSyncsAndWait,
  deleteFolderRuntimeState,
  enqueueFolderSyncOperation,
  runFolderSyncOperation,
  semanticSyncPolicy,
} from './state.ts';
import { publishSemanticPause } from './sync.ts';
import type { Indexer } from './indexer.ts';
import { filesystemPath } from './filesystem-path.ts';
import { MfsDaemonRetiringError } from './mfs-daemon.ts';

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

test('removing folder runtime state invalidates an in-flight reconcile', async () => {
  const folder = path.join(os.tmpdir(), 'stashbase-removal-cancels-sync');
  let shouldContinue: (() => boolean) | undefined;
  let releaseSync!: () => void;
  const syncGate = new Promise<void>((resolve) => { releaseSync = resolve; });
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  const deps = {
    indexer: {} as Indexer,
    bind: async () => undefined,
    sync: async (_indexer: Indexer, _root: string, options?: { shouldContinue?: () => boolean }) => {
      shouldContinue = options?.shouldContinue;
      markStarted();
      await syncGate;
      throw new Error('MFS daemon closing');
    },
    semanticEnabled: true,
  };

  const running = runFolderSyncOperation(folder, { reason: 'app boot' }, deps);
  let result;
  try {
    await started;
    assert.equal(shouldContinue?.(), true);
    await deleteFolderRuntimeState(folder);
    assert.equal(shouldContinue?.(), false, 'library removal must invalidate work already scanning the folder');
  } finally {
    releaseSync();
    result = await running;
  }
  assert.equal(result.cancelled, true, 'an interrupted reconcile is cancellation, not a visible sync failure');
});

test('a live folder reconcile resumes after another folder retires the shared daemon', async () => {
  const folder = path.join(os.tmpdir(), 'stashbase-live-sync-through-daemon-retirement');
  let bindCalls = 0;
  let syncCalls = 0;
  const deps = {
    indexer: {} as Indexer,
    bind: async () => { bindCalls += 1; },
    sync: async () => {
      syncCalls += 1;
      if (syncCalls === 1) throw new MfsDaemonRetiringError();
      return { added: [], modified: [], removed: [], renamed: [], failed: [] };
    },
    semanticEnabled: true,
  };

  const result = await runFolderSyncOperation(folder, { reason: 'library reconcile' }, deps);

  assert.equal(result.cancelled, undefined);
  assert.equal(bindCalls, 2, 'the replacement daemon must receive the folder binding again');
  assert.equal(syncCalls, 2, 'authoritative reconcile is safe to retry from the beginning');
});

test('folder removal interrupts an unresponsive reconcile instead of waiting behind it', async () => {
  const folder = path.join(os.tmpdir(), 'stashbase-removal-interrupts-sync');
  let releaseSync!: () => void;
  const syncGate = new Promise<void>((resolve) => { releaseSync = resolve; });
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  let interruptCalls = 0;
  const running = enqueueFolderSyncOperation(filesystemPath.identity(folder), async () => {
    markStarted();
    await syncGate;
  });
  await started;
  const cancellation = cancelFolderSyncsAndWait(folder, async () => {
    interruptCalls += 1;
    releaseSync();
  });
  const settledQuickly = await Promise.race([
    cancellation.then(() => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 50)),
  ]);
  if (!settledQuickly) releaseSync();
  await Promise.allSettled([running, cancellation]);

  assert.equal(settledQuickly, true, 'removal must interrupt a daemon scan before awaiting its queue');
  assert.equal(interruptCalls, 1);
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
