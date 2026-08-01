import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createLibraryOperations } from '../library-operations/index.ts';
import { mount } from './library-files.ts';

test('library search validates and forwards file-type filters', async () => {
  let searchInput: Record<string, unknown> | undefined;
  const operations = createLibraryOperations({
    retrieval: { search: async (input) => {
      searchInput = input as unknown as Record<string, unknown>;
      return {
        evidence: [],
        availability: { state: 'ready' as const },
        truncated: false,
      };
    } },
  });
  const app = express();
  app.use(express.json());
  mount(app, operations);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}/api/library/search`;

  try {
    const filtered = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'paper', types: ['pdf', 'docx'] }),
    });
    assert.equal(filtered.status, 200);
    assert.deepEqual(searchInput?.types, ['pdf', 'docx']);

    searchInput = undefined;
    const invalid = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'paper', types: ['spreadsheet'] }),
    });
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json() as { error: string }).error, /unknown search type/i);
    assert.equal(searchInput, undefined);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
