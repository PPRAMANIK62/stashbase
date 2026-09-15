import assert from 'node:assert/strict';
import test from 'node:test';
import { ProjectOperationError, createProjectOperations } from './index.ts';

const normalizeFolder = async (folder: unknown, pathPrefix: unknown) => {
  if (typeof folder !== 'string' || !folder) {
    throw new ProjectOperationError('folder required', 400, 'FOLDER_REQUIRED');
  }
  return {
    folderRoot: folder,
    ...(typeof pathPrefix === 'string' ? { pathPrefix } : {}),
  };
};

test('Project Operations rejects semantic retrieval without embedding configuration', async () => {
  const operations = createProjectOperations({
    normalizeSearchScope: normalizeFolder,
    retrieval: { search: async () => ({
      evidence: [], availability: { state: 'unavailable' as const, reason: 'embedding-key-required' as const }, truncated: false,
    }) },
  });
  await assert.rejects(
    operations.search({ query: 'architecture', folder: '/project', mode: 'hybrid' }),
    (error: unknown) => error instanceof ProjectOperationError
      && error.status === 412
      && error.code === 'EMBEDDER_KEY_REQUIRED',
  );
});

test('Project Operations keeps result identity at the visible source path in one Folder', async () => {
  const operations = createProjectOperations({
    normalizeSearchScope: normalizeFolder,
    retrieval: { search: async () => ({
      evidence: [{ sourcePath: '/project/paper.pdf', snippet: 'derived evidence', heading: '', locator: {}, score: 1, chunkIndex: 0 }],
      availability: { state: 'ready' as const }, truncated: false,
    }) },
  });
  assert.deepEqual(
    await operations.search({ query: 'paper', topK: 8, folder: '/project', mode: 'hybrid' }),
    { mode: 'hybrid', folder: '/project', hits: [{ fileName: '/project/paper.pdf', folder: '/project', path: 'paper.pdf', chunkIndex: 0, content: 'derived evidence', heading: '', score: 1 }] },
  );
});

test('Project Operations forwards Folder, path, type, and keyword options once', async () => {
  const inputs: Array<Record<string, unknown>> = [];
  const operations = createProjectOperations({
    normalizeSearchScope: normalizeFolder,
    retrieval: { search: async (input) => {
      inputs.push(input as unknown as Record<string, unknown>);
      return { evidence: [], availability: { state: 'ready' as const }, truncated: false };
    } },
  });
  await operations.search({
    query: 'ExactMatch', mode: 'grep', folder: '/project', pathPrefix: '/project/notes',
    types: ['notes'], caseStrict: true, wholeWord: true, topK: 3,
  });
  assert.deepEqual(inputs, [{
    mode: 'grep', query: 'ExactMatch', topK: 3, folderRoot: '/project',
    pathPrefix: '/project/notes', types: ['notes'], caseStrict: true, wholeWord: true,
  }]);
});

test('default retrieval follows current key configuration on every lookup', async () => {
  let configured = false;
  const calls: string[] = [];
  const { createRetrieval } = await import('../retrieval/index.ts');
  const operations = createProjectOperations({
    normalizeSearchScope: normalizeFolder,
    hasEmbeddingKey: () => configured,
    retrieval: createRetrieval({
      hasEmbeddingKey: () => configured,
      sourceAvailable: async () => true,
      hybridSearch: async () => { calls.push('hybrid'); return []; },
      grep: async () => { calls.push('grep'); return { files: [], truncated: false }; },
    }),
  });
  const search = (mode?: 'grep' | 'hybrid') => operations.search({ query: 'draft', folder: '/project', mode });
  assert.equal((await search()).mode, 'grep');
  configured = true;
  assert.equal((await search()).mode, 'hybrid');
  assert.equal((await search('grep')).mode, 'grep');
  configured = false;
  assert.equal((await search()).mode, 'grep');
  await assert.rejects(search('hybrid'), (error: unknown) =>
    error instanceof ProjectOperationError && error.code === 'EMBEDDER_KEY_REQUIRED');
  assert.deepEqual(calls, ['grep', 'hybrid', 'grep', 'grep']);
});

test('a hybrid provider failure is not silently downgraded to grep', async () => {
  const { createRetrieval } = await import('../retrieval/index.ts');
  let grepCalled = false;
  const operations = createProjectOperations({
    normalizeSearchScope: normalizeFolder,
    hasEmbeddingKey: () => true,
    retrieval: createRetrieval({
      hasEmbeddingKey: () => true,
      hybridSearch: async () => { throw new Error('provider unavailable'); },
      grep: async () => { grepCalled = true; return { files: [], truncated: false }; },
    }),
  });
  await assert.rejects(operations.search({ query: 'draft', folder: '/project' }), /provider unavailable/);
  assert.equal(grepCalled, false);
});

test('Project Operations surfaces a truncated result signal', async () => {
  const operations = createProjectOperations({
    normalizeSearchScope: normalizeFolder,
    retrieval: { search: async () => ({
      evidence: [{ sourcePath: '/project/a.md', snippet: 'match', heading: '', locator: { line: 3 } }],
      availability: { state: 'partial' as const, reason: 'truncated' as const }, truncated: true,
    }) },
  });
  const result = await operations.search({ query: 'match', folder: '/project' });
  assert.equal(result.truncated, true);
});

test('external search never inherits an unrelated active chat project', async (t) => {
  const { registerAttributedAgentSession, unregisterAttributedAgentSession } = await import('../agent-session-registry.ts');
  registerAttributedAgentSession('unrelated-search-policy', {
    agentId: 'claude', windowId: 'unrelated-window', boundFolder: () => '/other-project', turnInFlight: () => true,});
  t.after(() => unregisterAttributedAgentSession('unrelated-search-policy'));
  const operations = createProjectOperations({
    normalizeSearchScope: normalizeFolder,
    retrieval: { search: async () => ({
      evidence: [], availability: { state: 'ready' as const }, truncated: false,
    }) },
  });
  const result = await operations.search({ query: 'answer', folder: '/project', mode: 'hybrid' });
  assert.equal(result.mode, 'hybrid');
  assert.equal(result.folder, '/project');
});

test('Project Operations validates mutation fields before an adapter can write', async () => {
  const operations = createProjectOperations();
  await assert.rejects(
    operations.write({ path: '/project/note.md', content: undefined }),
    (error: unknown) => error instanceof ProjectOperationError && error.status === 400,
  );
});

for (const mode of ['hybrid', 'grep'] as const) {
  test(`Project Operations defaults ${mode} search to the attributed Folder`, async (t) => {
    const { registerAttributedAgentSession, unregisterAttributedAgentSession } = await import('../agent-session-registry.ts');
    let bound: string | null = '/project/one';
    const sessionId = `search-folder-${mode}`;
    registerAttributedAgentSession(sessionId, {
      agentId: 'claude', windowId: 'scope-window', boundFolder: () => bound, turnInFlight: () => true,});
    t.after(() => unregisterAttributedAgentSession(sessionId));
    const reached: string[] = [];
    const operations = createProjectOperations({
      normalizeSearchScope: normalizeFolder,
      retrieval: { search: async (input) => {
        reached.push(input.folderRoot);
        return { evidence: [], availability: { state: 'ready' as const }, truncated: false };
      } },
    });
    assert.equal((await operations.search({ query: 'answer', mode, agentSessionId: sessionId })).folder, '/project/one');
    bound = '/project/two';
    assert.equal((await operations.search({ query: 'answer', mode, agentSessionId: sessionId })).folder, '/project/two');
    bound = null;
    await assert.rejects(
      operations.search({ query: 'answer', mode, agentSessionId: sessionId }),
      (error: unknown) => error instanceof ProjectOperationError && error.code === 'FOLDER_REQUIRED',
    );
    await assert.rejects(
      operations.search({ query: 'answer', mode, agentSessionId: sessionId, folder: '/project/one' }),
      (error: unknown) => error instanceof ProjectOperationError && error.code === 'FOLDER_REQUIRED',
    );
    bound = '/project/two';
    await assert.rejects(
      operations.search({ query: 'answer', mode, agentSessionId: sessionId, folder: '/project/one' }),
      (error: unknown) => error instanceof ProjectOperationError && error.code === 'PROJECT_SCOPE_MISMATCH',
    );
    assert.deepEqual(reached, ['/project/one', '/project/two']);
  });
}

test('Project Operations rejects stale or ambiguous attribution when no Folder was supplied', async (t) => {
  const { registerAttributedAgentSession, unregisterAttributedAgentSession } = await import('../agent-session-registry.ts');
  const operations = createProjectOperations({ normalizeSearchScope: normalizeFolder });
  await assert.rejects(operations.search({ query: 'answer', agentSessionId: 'retired-session' }), /session is no longer available/);
  for (const id of ['scope-first', 'scope-second']) {
    registerAttributedAgentSession(id, {
      agentId: 'claude', windowId: 'shared-window', boundFolder: () => `/project/${id}`, turnInFlight: () => true,});
    t.after(() => unregisterAttributedAgentSession(id));
  }
  await assert.rejects(operations.search({ query: 'answer', windowId: 'shared-window' }), /ambiguous/);
});


test('reindex requires one project and never fans out after a failure', async () => {
  const reached: string[] = [];
  const operations = createProjectOperations({
    normalizeSearchScope: normalizeFolder,
    reindexFolder: async (folder) => { reached.push(folder); throw new Error('controlled failure'); },
  });
  await assert.rejects(operations.reindex(), /folder required/);
  assert.deepEqual(reached, []);
  await assert.rejects(operations.reindex({ folder: '/project/one' }), /controlled failure/);
  assert.deepEqual(reached, ['/project/one']);
});

test('directory listing requires a path instead of exposing a virtual global root', async () => {
  const operations = createProjectOperations();
  await assert.rejects(operations.listDirectory(), /path required/);
  await assert.rejects(operations.listDirectory(''), /path required/);
});
