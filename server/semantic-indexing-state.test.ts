import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  cancelFolderSyncsAndWait,
  deleteFolderRuntimeState,
  embeddingRuntimeUnavailableMessage,
  enqueueFolderSyncOperation,
  runFolderSyncOperation,
} from './state.ts';
import type { Indexer } from './indexer.ts';
import { filesystemPath } from './filesystem-path.ts';
import { MfsDaemonRetiringError } from './mfs-daemon.ts';

test('embedding runtime warning explains the BYOK requirement', () => {
  assert.match(embeddingRuntimeUnavailableMessage(
    '/library/research',
    { configured: false, available: false, reason: 'embedding-source-required' },
  ), /OpenAI or OpenRouter key/);
});

test('Folder sync operations are serialized', async () => {
  const events: string[] = [];
  let releaseOlder!: () => void;
  const olderGate = new Promise<void>((resolve) => { releaseOlder = resolve; });
  const older = enqueueFolderSyncOperation('folder-race', async () => {
    events.push('older-start');
    await olderGate;
    events.push('older-finish');
  });
  const newer = enqueueFolderSyncOperation('folder-race', async () => {
    events.push('newer-start');
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ['older-start']);
  releaseOlder();
  await Promise.all([older, newer]);
  assert.deepEqual(events, ['older-start', 'older-finish', 'newer-start']);
});

test('removing Folder runtime state invalidates an in-flight reconcile', async () => {
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
  };
  const running = runFolderSyncOperation(folder, { reason: 'app boot' }, deps);
  let result;
  try {
    await started;
    assert.equal(shouldContinue?.(), true);
    await deleteFolderRuntimeState(folder);
    assert.equal(shouldContinue?.(), false);
  } finally {
    releaseSync();
    result = await running;
  }
  assert.equal(result.cancelled, true);
});

test('a live Folder reconcile retries after shared daemon retirement', async () => {
  const folder = path.join(os.tmpdir(), 'stashbase-live-sync-through-daemon-retirement');
  let bindCalls = 0;
  let syncCalls = 0;
  const result = await runFolderSyncOperation(folder, { reason: 'library reconcile' }, {
    indexer: {} as Indexer,
    bind: async () => { bindCalls += 1; },
    sync: async () => {
      syncCalls += 1;
      if (syncCalls === 1) throw new MfsDaemonRetiringError();
      return { added: [], modified: [], removed: [], failed: [] };
    },
  });
  assert.equal(result.cancelled, undefined);
  assert.equal(bindCalls, 2);
  assert.equal(syncCalls, 2);
});

test('a Folder reconcile rebinds once when runtime reset drops the binding', async () => {
  const folder = path.join(os.tmpdir(), 'stashbase-live-sync-through-binding-reset');
  let bindCalls = 0;
  let syncCalls = 0;
  const result = await runFolderSyncOperation(folder, { reason: 'runtime reset' }, {
    indexer: {} as Indexer,
    bind: async () => { bindCalls += 1; },
    sync: async () => {
      syncCalls += 1;
      if (syncCalls === 1) return {
        added: [], modified: [], removed: [],
        failed: [{ name: path.join(folder, 'paper.pdf'), error: `no bound root matches path '${path.join(folder, 'paper.pdf')}'; call bind_root first` }],
      };
      return { added: ['paper.pdf'], modified: [], removed: [], failed: [] };
    },
  });
  assert.deepEqual(result.failed, []);
  assert.equal(bindCalls, 2);
  assert.equal(syncCalls, 2);
});

test('Folder removal interrupts an unresponsive reconcile before waiting', async () => {
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
  assert.equal(settledQuickly, true);
  assert.equal(interruptCalls, 1);
});
