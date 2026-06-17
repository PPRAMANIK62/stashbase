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

class FakeIndexer implements Indexer {
  deleted: string[] = [];
  upserted: string[] = [];
  failDeletes = new Set<string>();

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
  async renameFile(_oldPath: string, _newPath: string, _content: string): Promise<void> {}
  async renamePathPrefix(_oldPrefix: string, _newPrefix: string, _files: Array<{ path: string; content: string }>): Promise<void> {}
  async search(_query: string, _topK: number, _space?: string, _pathPrefix?: string): Promise<SearchHit[]> { return []; }
  async syncDiff(_space?: string): Promise<SyncDiff> { return this.diff; }
  async status(_space?: string): Promise<IndexStatus> {
    return { total: 0, indexed: 0, pendingCount: 0, pending: [], orphanedCount: 0, orphaned: [], upToDate: true };
  }
  async listFiles(_space?: string): Promise<Record<string, string>> { return {}; }
  async closeStore(): Promise<void> {}
  async close(): Promise<void> {}
}

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
