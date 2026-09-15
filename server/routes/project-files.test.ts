import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { applyLineRange } from '../project-file-reader.ts';
import { createProjectOperations } from '../project-operations/index.ts';
import { registerAttributedAgentSession, unregisterAttributedAgentSession } from '../agent-session-registry.ts';
import { mount } from './project-files.ts';

test('project search validates and forwards file-type filters', async (t) => {
  registerAttributedAgentSession('panel-session', {
    agentId: 'claude', windowId: 'route-window', boundFolder: () => '/project', turnInFlight: () => true,});
  t.after(() => unregisterAttributedAgentSession('panel-session'));
  let normalizedFolder: unknown;
  let searchInput: Record<string, unknown> | undefined;
  const operations = createProjectOperations({
    hasEmbeddingKey: () => false,
    normalizeSearchScope: async (folder, pathPrefix) => {
      normalizedFolder = folder;
      return { folderRoot: folder as string | undefined ?? '/project', pathPrefix: typeof pathPrefix === 'string' ? pathPrefix : undefined };
    },
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
  const url = `http://127.0.0.1:${address.port}/api/project/search`;

  try {
    const filtered = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'paper', folder: '/project', types: ['pdf', 'docx'] }),
    });
    assert.equal(filtered.status, 200);
    assert.deepEqual(searchInput?.types, ['pdf', 'docx']);

    searchInput = undefined;
    const keyword = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: 'ExactMatch',
        folder: '/project',
        mode: 'keyword',
        path_prefix: '/project/notes',
        types: ['notes'],
        case_strict: true,
        whole_word: true,
        top_k: 3,
      }),
    });
    assert.equal(keyword.status, 200);
    assert.deepEqual(searchInput, {
      mode: 'grep',
      query: 'ExactMatch',
      topK: 3,
      folderRoot: '/project',
      pathPrefix: '/project/notes',
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
      body: JSON.stringify({ query: 'prepared evidence', mode: 'semantic' }),
    });
    assert.equal(policySearch.status, 200);
    assert.equal(normalizedFolder, '/project');
    const explicitFolderSearch = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-stashbase-agent-session-id': 'panel-session' },
      body: JSON.stringify({ query: 'answer', folder: '/project' }),
    });
    assert.equal(explicitFolderSearch.status, 200);
    assert.equal(normalizedFolder, '/project');
    assert.equal((searchInput as Record<string, unknown> | undefined)?.mode, 'grep');
    assert.equal((await policySearch.json() as { mode: string }).mode, 'semantic');

    for (const id of ['', '   ', 'retired']) {
      const invalidIdentity = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-stashbase-agent-session-id': id,
          'x-stashbase-window-id': 'route-window',
        },
        body: JSON.stringify({ query: 'paper' }),
      });
      assert.equal(invalidIdentity.status, 409, `explicit invalid session: ${JSON.stringify(id)}`);
    }
    const windowIdentity = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-stashbase-window-id': 'route-window' },
      body: JSON.stringify({ query: 'paper' }),
    });
    assert.equal(windowIdentity.status, 200);

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
    path: '/project/notes/long.md',
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
  const operations = createProjectOperations({
    read: (async (...args: unknown[]) => {
      readArgs = args;
      return { path: '/project/notes/long.md', format: 'md', content: 'two\n' };
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
  const url = `http://127.0.0.1:${address.port}/api/project/file`;

  try {
    const windowed = await fetch(`${url}?path=%2Fproject%2Fnotes%2Flong.md&offset=2&limit=1`);
    assert.equal(windowed.status, 200);
    assert.deepEqual(readArgs[1], { offset: 2, limit: 1 });

    readArgs = [];
    const whole = await fetch(`${url}?path=%2Fproject%2Fnotes%2Flong.md`);
    assert.equal(whole.status, 200);
    assert.equal(readArgs[1], undefined);

    readArgs = [];
    const bad = await fetch(`${url}?path=%2Fproject%2Fnotes%2Flong.md&offset=0`);
    assert.equal(bad.status, 400);
    assert.match((await bad.json() as { error: string }).error, /offset must be a positive integer/);
    assert.deepEqual(readArgs, []);

    const empty = await fetch(`${url}?path=%2Fproject%2Fnotes%2Flong.md&limit=`);
    assert.equal(empty.status, 400);
    assert.match((await empty.json() as { error: string }).error, /limit must be a positive integer/);
    assert.deepEqual(readArgs, []);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});


test('HTTP file access keeps attributed Chats in their bound project across awaits', async (t) => {
  const { assertProjectScope } = await import('../project-request-scope.ts');
  for (const [id, folder] of [['one', '/project/one'], ['two', '/project/two'], ['starting', null]] as const) {
    registerAttributedAgentSession(id, {
      agentId: 'claude', windowId: 'scope-window', boundFolder: () => folder, turnInFlight: () => true,});
    t.after(() => unregisterAttributedAgentSession(id));
  }
  const operations = createProjectOperations({
    read: async (rawPath) => {
      await new Promise<void>((resolve) => setImmediate(resolve));
      assertProjectScope(String(rawPath).replace(/\/note\.md$/, ''));
      return { path: String(rawPath), format: 'md', content: 'scoped' };
    },
  });
  const app = express();
  mount(app, operations);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => { server.closeAllConnections(); server.close(); });
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const read = (session: string, project: string) => fetch(
    `http://127.0.0.1:${address.port}/api/project/file?path=/project/${project}/note.md`,
    { headers: { 'x-stashbase-agent-session-id': session } },
  );
  const responses = await Promise.all([read('one', 'one'), read('two', 'two'), read('one', 'two'), read('starting', 'one'), read('retired', 'one')]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200, 403, 400, 409]);
});


test('nested project registration does not invalidate paths inside the bound parent project', async (t) => {
  const { assertProjectPath, assertProjectScope, withAgentProjectScope } = await import('../project-request-scope.ts');
  const { registerAttributedAgentSession, unregisterAttributedAgentSession } = await import('../agent-session-registry.ts');
  const id = 'nested-project-parent';
  registerAttributedAgentSession(id, {
    agentId: 'claude', windowId: 'nested-window', boundFolder: () => '/project/parent', turnInFlight: () => true,});
  t.after(() => unregisterAttributedAgentSession(id));
  await withAgentProjectScope(id, async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.doesNotThrow(() => assertProjectPath('/project/parent/child/note.md'));
    assert.doesNotThrow(() => assertProjectScope('/project/parent'));
    assert.throws(() => assertProjectScope('/project/parent/child'), /conversation project/);
    assert.throws(() => assertProjectPath('/project/parent-other/note.md'), /conversation project/);
  });
});


test('HTTP search keeps wire modes while defaults follow current key configuration', async (t) => {
  const { createRetrieval } = await import('../retrieval/index.ts');
  let configured = false;
  const operations = createProjectOperations({
    hasEmbeddingKey: () => configured,
    normalizeSearchScope: async (folder) => ({ folderRoot: folder as string }),
    retrieval: createRetrieval({
      hasEmbeddingKey: () => configured,
      hybridSearch: async () => [],
      grep: async () => ({ files: [], truncated: false }),
    }),
  });
  const app = express();
  app.use(express.json());
  mount(app, operations);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => { server.closeAllConnections(); server.close(); });
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const request = (mode?: string) => fetch(`http://127.0.0.1:${address.port}/api/project/search`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'draft', folder: '/project', ...(mode ? { mode } : {}) }),
  });
  for (const hasKey of [false, true, false]) {
    configured = hasKey;
    const response = await request();
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { mode: string }).mode, hasKey ? 'semantic' : 'keyword');
    assert.equal((await (await request('keyword')).json() as { mode: string }).mode, 'keyword');
  }
  const explicit = await request('semantic');
  assert.equal(explicit.status, 412);
  assert.equal((await explicit.json() as { code: string }).code, 'EMBEDDER_KEY_REQUIRED');
  assert.equal((await request('invalid')).status, 400);
});
