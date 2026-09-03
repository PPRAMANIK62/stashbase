import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { applyLineRange } from '../library-file-reader.ts';
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

test('read windows return only the requested lines and drop the version token', () => {
  const whole = {
    path: '/library/notes/long.md',
    format: 'md',
    content: 'one\ntwo\nthree\nfour\n',
    version: 'v1',
  };

  assert.deepEqual(applyLineRange(whole, undefined), whole);
  assert.deepEqual(applyLineRange(whole, { offset: 1 }), {
    path: whole.path,
    format: 'md',
    content: whole.content,
    partial: true,
    totalLines: 4,
  });

  assert.deepEqual(applyLineRange(whole, { offset: 2, limit: 2 }), {
    path: whole.path,
    format: 'md',
    content: 'two\nthree\n',
    partial: true,
    totalLines: 4,
    nextOffset: 4,
  });

  // A window that ends the file reports no next offset and keeps the source's
  // trailing-newline convention.
  assert.deepEqual(applyLineRange(whole, { offset: 4, limit: 10 }), {
    path: whole.path,
    format: 'md',
    content: 'four\n',
    partial: true,
    totalLines: 4,
  });
  assert.equal(
    applyLineRange({ ...whole, content: 'one\ntwo' }, { offset: 2, limit: 5 }).content,
    'two',
  );

  // Past the end is an empty window, not an error and not a whole-file read.
  assert.equal(applyLineRange(whole, { offset: 99, limit: 5 }).content, '');
});

test('read route forwards a line window and rejects a malformed one', async () => {
  let readArgs: unknown[] = [];
  const operations = createLibraryOperations({
    read: (async (...args: unknown[]) => {
      readArgs = args;
      return { path: '/library/notes/long.md', format: 'md', content: 'two\n' };
    }) as never,
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
  const url = `http://127.0.0.1:${address.port}/api/library/file`;

  try {
    const windowed = await fetch(`${url}?path=%2Flibrary%2Fnotes%2Flong.md&offset=2&limit=1`);
    assert.equal(windowed.status, 200);
    assert.deepEqual(readArgs[1], { offset: 2, limit: 1 });

    readArgs = [];
    const whole = await fetch(`${url}?path=%2Flibrary%2Fnotes%2Flong.md`);
    assert.equal(whole.status, 200);
    assert.equal(readArgs[1], undefined);

    readArgs = [];
    const bad = await fetch(`${url}?path=%2Flibrary%2Fnotes%2Flong.md&offset=0`);
    assert.equal(bad.status, 400);
    assert.match((await bad.json() as { error: string }).error, /offset must be a positive integer/);
    assert.deepEqual(readArgs, []);

    const empty = await fetch(`${url}?path=%2Flibrary%2Fnotes%2Flong.md&limit=`);
    assert.equal(empty.status, 400);
    assert.match((await empty.json() as { error: string }).error, /limit must be a positive integer/);
    assert.deepEqual(readArgs, []);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
