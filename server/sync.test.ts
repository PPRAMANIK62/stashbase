import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { EmbedderRuntimeConfig, Indexer, IndexStatus, SearchHit, SyncDiff } from './indexer.ts';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-${label}-`));
}

const home = tmpDir('sync-home');
process.env.HOME = home;
process.env.STASHBASE_LOCAL_DATA_ROOT = path.join(home, 'app-data');

async function configureForSyncTest(kbRoot: string): Promise<void> {
  const { readAppConfig, writeAppConfig } = await import('./app-config.ts');
  writeAppConfig({ ...readAppConfig(), apiKey: 'test-key', kbRoot });
}

async function configureNoKeyForSyncTest(kbRoot: string): Promise<void> {
  const { readAppConfig, writeAppConfig } = await import('./app-config.ts');
  const cfg = readAppConfig();
  delete cfg.apiKey;
  writeAppConfig({ ...cfg, kbRoot });
}

class FakeIndexer implements Indexer {
  deleted: string[] = [];
  upserted: string[] = [];
  renamed: Array<{ oldPath: string; newPath: string; content: string }> = [];
  failDeletes = new Set<string>();
  failRenames = new Set<string>();
  syncDiffCalls = 0;

  constructor(private readonly diff: SyncDiff) {}

  async bindSpace(_space: string, _cfg: EmbedderRuntimeConfig): Promise<void> {}
  async unbindSpace(_space: string): Promise<void> {}

  async upsertFile(filePath: string, _content: string): Promise<void> {
    this.upserted.push(filePath);
  }

  async deleteFile(filePath: string): Promise<void> {
    if (this.failDeletes.has(filePath)) throw new Error('delete failed');
    this.deleted.push(filePath);
  }

  async deletePathPrefix(_prefix: string): Promise<void> {}
  async renameFile(oldPath: string, newPath: string, content: string): Promise<void> {
    if (this.failRenames.has(newPath)) throw new Error('rename failed');
    this.renamed.push({ oldPath, newPath, content });
  }
  async renamePathPrefix(_oldPrefix: string, _newPrefix: string, _files: Array<{ path: string; content: string }>): Promise<void> {}
  async search(_query: string, _topK: number, _space?: string, _pathPrefix?: string): Promise<SearchHit[]> { return []; }
  async syncDiff(_space?: string): Promise<SyncDiff> {
    this.syncDiffCalls += 1;
    return this.diff;
  }
  async status(_space?: string): Promise<IndexStatus> {
    return { total: 0, indexed: 0, pendingCount: 0, pending: [], orphanedCount: 0, orphaned: [], upToDate: true };
  }
  async listFiles(_space?: string): Promise<Record<string, string>> { return {}; }
  async closeStore(): Promise<void> {}
  async close(): Promise<void> {}
}

test('syncIndex no-ops without an OpenAI key', async () => {
  const kbRoot = tmpDir('sync-no-key-kb');
  await configureNoKeyForSyncTest(kbRoot);
  const { syncIndex } = await import('./sync.ts');
  const fake = new FakeIndexer({
    added: ['Project/one.md'],
    modified: ['Project/two.md'],
    deleted: ['Project/gone.md'],
    renamed: [{ old: 'Project/old.md', new: 'Project/new.md', fileHash: 'hash' }],
  });

  const result = await syncIndex(fake, 'Project');

  assert.deepEqual(result, { added: [], modified: [], removed: [], renamed: [], failed: [] });
  assert.equal(fake.syncDiffCalls, 0);
  assert.deepEqual(fake.upserted, []);
  assert.deepEqual(fake.deleted, []);
});

test('syncIndex only reports successfully deleted index rows as removed', async () => {
  const kbRoot = tmpDir('sync-kb');
  await configureForSyncTest(kbRoot);
  const { syncIndex } = await import('./sync.ts');
  const fake = new FakeIndexer({
    added: [],
    modified: [],
    deleted: ['Project/gone.md', 'Project/stuck.md'],
    renamed: [],
  });
  fake.failDeletes.add('Project/stuck.md');

  const result = await syncIndex(fake, 'Project');

  assert.deepEqual(result.removed, ['gone.md']);
  assert.deepEqual(fake.deleted, ['Project/gone.md']);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].name, 'stuck.md');
});

test('syncIndex stops between files when the caller cancels a stale sync', async () => {
  const kbRoot = tmpDir('sync-cancel-kb');
  const spaceRoot = path.join(kbRoot, 'Project');
  fs.mkdirSync(spaceRoot, { recursive: true });
  fs.writeFileSync(path.join(spaceRoot, 'one.md'), '# one\n');
  fs.writeFileSync(path.join(spaceRoot, 'two.md'), '# two\n');
  await configureForSyncTest(kbRoot);
  const { syncIndex } = await import('./sync.ts');
  const fake = new FakeIndexer({
    added: ['Project/one.md', 'Project/two.md'],
    modified: [],
    deleted: [],
    renamed: [],
  });

  const result = await syncIndex(fake, 'Project', {
    shouldContinue: () => fake.upserted.length < 1,
  });

  assert.equal(result.cancelled, true);
  assert.deepEqual(result.added, ['one.md']);
  assert.deepEqual(fake.upserted, ['Project/one.md']);
});

test('syncIndex deletes the stale source row when a detected rename target is not indexable', async () => {
  const kbRoot = tmpDir('sync-rename-empty-kb');
  const spaceRoot = path.join(kbRoot, 'Project');
  fs.mkdirSync(spaceRoot, { recursive: true });
  fs.writeFileSync(path.join(spaceRoot, 'new.md'), '');
  await configureForSyncTest(kbRoot);
  const { syncIndex } = await import('./sync.ts');
  const fake = new FakeIndexer({
    added: [],
    modified: [],
    deleted: [],
    renamed: [{ old: 'Project/old.md', new: 'Project/new.md', fileHash: 'hash' }],
  });

  const result = await syncIndex(fake, 'Project');

  assert.deepEqual(fake.renamed, []);
  assert.deepEqual(fake.deleted, ['Project/old.md']);
  assert.deepEqual(result.renamed, []);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].name, 'new.md');
  assert.match(result.failed[0].error, /empty file/);
});

test('syncIndex deletes the stale source row when index rename fails', async () => {
  const kbRoot = tmpDir('sync-rename-fail-kb');
  const spaceRoot = path.join(kbRoot, 'Project');
  fs.mkdirSync(spaceRoot, { recursive: true });
  fs.writeFileSync(path.join(spaceRoot, 'new.md'), '# moved\n');
  await configureForSyncTest(kbRoot);
  const { syncIndex } = await import('./sync.ts');
  const fake = new FakeIndexer({
    added: [],
    modified: [],
    deleted: [],
    renamed: [{ old: 'Project/old.md', new: 'Project/new.md', fileHash: 'hash' }],
  });
  fake.failRenames.add('Project/new.md');

  const result = await syncIndex(fake, 'Project');

  assert.deepEqual(fake.deleted, ['Project/old.md']);
  assert.deepEqual(result.renamed, []);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].name, 'new.md');
  assert.match(result.failed[0].error, /rename failed/);
});
