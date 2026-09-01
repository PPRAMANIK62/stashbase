import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createLibraryOperations } from '../library-operations/index.ts';
import { mount } from './library-files.ts';

test('library search validates and forwards file-type filters', async () => {
  let searchInput: Record<string, unknown> | undefined;
  let attributedSession: string | undefined;
  const operations = createLibraryOperations({
    normalizeSearchScope: async (_folder, pathPrefix) => ({
      folderRoot: '/library',
      pathPrefix: typeof pathPrefix === 'string' ? pathPrefix : undefined,
    }),
    retrieval: { search: async (input) => {
      searchInput = input as unknown as Record<string, unknown>;
      return {
        evidence: [],
        availability: { state: 'ready' as const },
        truncated: false,
      };
    } },
    similaritySearchEnabled: (sessionId) => {
      attributedSession = sessionId;
      return sessionId === 'panel-session' ? false : null;
    },
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
    const keyword = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: 'ExactMatch',
        mode: 'keyword',
        path_prefix: '/library/notes',
        types: ['notes'],
        case_strict: true,
        whole_word: true,
        top_k: 3,
      }),
    });
    assert.equal(keyword.status, 200);
    assert.deepEqual(searchInput, {
      mode: 'keyword',
      query: 'ExactMatch',
      topK: 3,
      folderRoot: '/library',
      pathPrefix: '/library/notes',
      types: ['notes'],
      caseStrict: true,
      wholeWord: true,
    });

    searchInput = undefined;
    const policySearch = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-stashbase-agent-session-id': 'panel-session',
      },
      body: JSON.stringify({ query: 'prepared evidence', mode: 'semantic', folder: '/library' }),
    });
    assert.equal(policySearch.status, 200);
    assert.equal(attributedSession, 'panel-session');
    assert.equal((searchInput as Record<string, unknown> | undefined)?.mode, 'keyword');
    assert.equal((await policySearch.json() as { mode: string }).mode, 'keyword');

    searchInput = undefined;
    const invalid = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'paper', types: ['spreadsheet'] }),
    });
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json() as { error: string }).error, /unknown search type/i);
    assert.equal(searchInput, undefined);

    const invalidMode = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'paper', mode: 'typo' }),
    });
    assert.equal(invalidMode.status, 400);
    assert.deepEqual(await invalidMode.json(), {
      error: 'unknown search mode; mode must be one of: semantic, keyword',
      code: 'INVALID_SEARCH_MODE',
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
