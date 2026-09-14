import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { syncIndex } from './sync.ts';
import type { Indexer } from './indexer.ts';
import { prepareForIndex } from './indexer.mfs.ts';
import { validatePreparedAudioTranscript } from './prepared-validation.ts';
import { hasNoExtractableText, indexableFileSizeError, MAX_INDEXABLE_BYTES } from './indexable.ts';

for (const [source, content] of [
  ['/library/Data.JSON', '\uFEFF{\r\n  "z": 1,\r\n  "broken":\r\n'],
  ['/library/README.TXT', '\uFEFFheading-like # source\r\n[link](note.md)\r\n'],
] as const) {
  test(`${path.extname(source).toLowerCase()} indexing keeps literal UTF-8`, () => {
    const prepared = prepareForIndex(source, content);
    assert.equal(prepared, content);
  });
}

test('direct-text admission rejects empty and oversized input', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-direct-admission-'));
  try {
    const empty = path.join(root, 'empty.json');
    const whitespace = path.join(root, 'space.txt');
    const oversized = path.join(root, 'large.json');
    fs.writeFileSync(empty, '');
    fs.writeFileSync(whitespace, '  \n\t');
    fs.closeSync(fs.openSync(oversized, 'w'));
    fs.truncateSync(oversized, MAX_INDEXABLE_BYTES + 1);
    assert.equal(indexableFileSizeError(empty), 'empty file');
    assert.equal(hasNoExtractableText(whitespace), true);
    assert.match(indexableFileSizeError(oversized) ?? '', /too large/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('TXT reconcile removes a stale row instead of indexing invalid UTF-8', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-invalid-txt-reconcile-'));
  try {
    const invalid = path.join(root, 'broken.txt');
    fs.writeFileSync(invalid, Buffer.from([0x6e, 0x65, 0x80, 0x64, 0x6c, 0x65]));
    const upserts: string[] = [];
    const deletes: string[] = [];
    const indexer = {
      listDocuments: async () => [invalid],
      upsertFile: async (source: string) => {
        upserts.push(source);
        return { outcome: 'updated' as const };
      },
      deleteFile: async (source: string) => { deletes.push(source); },
    } as unknown as Indexer;
    const result = await syncIndex(indexer, root);
    assert.deepEqual(upserts, []);
    assert.deepEqual(deletes, [invalid]);
    assert.deepEqual(result.failed, [{ name: 'broken.txt', error: 'source text could not be decoded safely' }]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('JSON reconcile lets MFS classify content and treats an external rename as add plus remove', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-json-reconcile-'));
  try {
    const added = path.join(root, 'added.json');
    const modified = path.join(root, 'modified.JSON');
    const deleted = path.join(root, 'deleted.json');
    const oldName = path.join(root, 'old.json');
    const renamed = path.join(root, 'renamed.JSON');
    fs.writeFileSync(added, '{"added": true}');
    fs.writeFileSync(modified, '{ malformed modified');
    fs.writeFileSync(renamed, '{"same": true}');
    const events: string[] = [];
    const indexer = {
      listDocuments: async () => [modified, deleted, oldName],
      upsertFile: async (source: string) => {
        events.push(`upsert:${source}`);
        return {
          outcome: source === modified ? 'updated' as const : 'added' as const,
        };
      },
      deleteFile: async (source: string) => { events.push(`delete:${source}`); },
    } as unknown as Indexer;
    const result = await syncIndex(indexer, root);
    assert.equal(events.length, 5);
    assert.deepEqual(result.added, ['added.json', 'renamed.JSON']);
    assert.deepEqual(result.modified, ['modified.JSON']);
    assert.deepEqual(result.removed, ['deleted.json', 'old.json']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('large audio transcript parsing and schema validation yield the event loop', async () => {
  const segments = Array.from({ length: 50_000 }, (_, index) => ({
    id: index + 1, startMs: index, endMs: index + 1, text: `segment ${index}`,
  }));
  const input = Buffer.from(JSON.stringify({
    schemaVersion: 1,
    source: { durationMs: segments.length + 1, size: 42, mtimeMs: 1, statIdentity: '1:2:3', contentHash: 'a'.repeat(64) },
    provider: { id: 'test', version: '1', model: 'test-model' },
    language: 'en', createdAt: '2025-01-01T00:00:00.000Z', segments,
  }));
  let timerRan = false;
  const validation = validatePreparedAudioTranscript(input);
  setTimeout(() => { timerRan = true; }, 0);
  const identity = await validation;
  assert.equal(timerRan, true);
  assert.equal(identity.contentHash, 'a'.repeat(64));
});

test('reconcile offers text to MFS for exact search without an embedding key', async () => {
  let listed = false;
  let upserted = false;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-no-key-'));
  try {
    fs.writeFileSync(path.join(root, 'note.md'), 'available to MFS grep');
    const result = await syncIndex({
      listDocuments: async () => { listed = true; return []; },
      upsertFile: async () => { upserted = true; return { outcome: 'added' }; },
    } as unknown as Indexer, root);
    assert.equal(listed, true);
    assert.equal(upserted, true);
    assert.deepEqual(result, { added: ['note.md'], modified: [], removed: [], failed: [] });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
