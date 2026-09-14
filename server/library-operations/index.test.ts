import assert from 'node:assert/strict';
import test from 'node:test';
import { LibraryOperationError, createLibraryOperations } from './index.ts';

const normalizeFolder = async (folder: unknown, pathPrefix: unknown) => {
  if (typeof folder !== 'string' || !folder) {
    throw new LibraryOperationError('folder required', 400, 'FOLDER_REQUIRED');
  }
  return {
    folderRoot: folder,
    ...(typeof pathPrefix === 'string' ? { pathPrefix } : {}),
  };
};

test('Library Operations rejects semantic retrieval without embedding configuration', async () => {
  const operations = createLibraryOperations({
    normalizeSearchScope: normalizeFolder,
    retrieval: { search: async () => ({
      evidence: [], availability: { state: 'unavailable' as const, reason: 'embedding-key-required' as const }, truncated: false,
    }) },
  });
  await assert.rejects(
    operations.search({ query: 'architecture', folder: '/library' }),
    (error: unknown) => error instanceof LibraryOperationError
      && error.status === 412
      && error.code === 'EMBEDDER_KEY_REQUIRED',
  );
});

test('Library Operations keeps result identity at the visible source path in one Folder', async () => {
  const operations = createLibraryOperations({
    normalizeSearchScope: normalizeFolder,
    retrieval: { search: async () => ({
      evidence: [{ sourcePath: '/library/paper.pdf', snippet: 'derived evidence', heading: '', locator: {}, score: 1, chunkIndex: 0 }],
      availability: { state: 'ready' as const }, truncated: false,
    }) },
  });
  assert.deepEqual(
    await operations.search({ query: 'paper', topK: 8, folder: '/library' }),
    { mode: 'semantic', folder: '/library', hits: [{ fileName: '/library/paper.pdf', folder: '/library', path: 'paper.pdf', chunkIndex: 0, content: 'derived evidence', heading: '', score: 1 }] },
  );
});

test('Library Operations forwards Folder, path, type, and keyword options once', async () => {
  const inputs: Array<Record<string, unknown>> = [];
  const operations = createLibraryOperations({
    normalizeSearchScope: normalizeFolder,
    retrieval: { search: async (input) => {
      inputs.push(input as unknown as Record<string, unknown>);
      return { evidence: [], availability: { state: 'ready' as const }, truncated: false };
    } },
  });
  await operations.search({
    query: 'ExactMatch', mode: 'keyword', folder: '/library', pathPrefix: '/library/notes',
    types: ['notes'], caseStrict: true, wholeWord: true, topK: 3,
  });
  assert.deepEqual(inputs, [{
    mode: 'keyword', query: 'ExactMatch', topK: 3, folderRoot: '/library',
    pathPrefix: '/library/notes', types: ['notes'], caseStrict: true, wholeWord: true,
  }]);
});

test('Library Operations resolves an attributed search-by-meaning-off request to lexical retrieval', async () => {
  const modes: string[] = [];
  const operations = createLibraryOperations({
    similaritySearchEnabled: () => false,
    normalizeSearchScope: normalizeFolder,
    retrieval: { search: async (input) => {
      modes.push(input.mode);
      return {
        evidence: [{ sourcePath: '/library/paper.pdf', snippet: 'prepared text match', locator: { line: 7, page: 2 } }],
        availability: { state: 'ready' as const }, truncated: false,
      };
    } },
  });
  const result = await operations.search({ query: 'prepared text', mode: 'semantic', folder: '/library' });
  assert.deepEqual(modes, ['keyword']);
  assert.equal(result.mode, 'keyword');
});

test('Library Operations surfaces a truncated result signal', async () => {
  const operations = createLibraryOperations({
    normalizeSearchScope: normalizeFolder,
    retrieval: { search: async () => ({
      evidence: [{ sourcePath: '/library/a.md', snippet: 'match', heading: '', locator: { line: 3 } }],
      availability: { state: 'partial' as const, reason: 'truncated' as const }, truncated: true,
    }) },
  });
  const result = await operations.search({ query: 'match', folder: '/library' });
  assert.equal(result.truncated, true);
});

test('Library Operations validates mutation fields before an adapter can write', async () => {
  const operations = createLibraryOperations();
  await assert.rejects(
    operations.write({ path: '/library/note.md', content: undefined }),
    (error: unknown) => error instanceof LibraryOperationError && error.status === 400,
  );
});

for (const mode of ['semantic', 'keyword'] as const) {
  test(`Library Operations defaults ${mode} search to the attributed Folder`, async (t) => {
    const { registerAttributedAgentSession, unregisterAttributedAgentSession } = await import('../agent-session-registry.ts');
    let bound: string | null = '/library/one';
    const sessionId = `search-folder-${mode}`;
    registerAttributedAgentSession(sessionId, {
      agentId: 'claude', windowId: 'scope-window', boundFolder: () => bound,
      isLibraryScoped: () => bound == null, turnInFlight: () => true,
      nativeSessionId: () => null, similaritySearchEnabled: () => true,
      rebindToFolder: () => false,
    });
    t.after(() => unregisterAttributedAgentSession(sessionId));
    const reached: string[] = [];
    const operations = createLibraryOperations({
      normalizeSearchScope: normalizeFolder,
      retrieval: { search: async (input) => {
        reached.push(input.folderRoot);
        return { evidence: [], availability: { state: 'ready' as const }, truncated: false };
      } },
    });
    assert.equal((await operations.search({ query: 'answer', mode, agentSessionId: sessionId })).folder, '/library/one');
    bound = '/library/two';
    assert.equal((await operations.search({ query: 'answer', mode, agentSessionId: sessionId })).folder, '/library/two');
    bound = null;
    await assert.rejects(
      operations.search({ query: 'answer', mode, agentSessionId: sessionId }),
      (error: unknown) => error instanceof LibraryOperationError && error.code === 'FOLDER_REQUIRED',
    );
    await operations.search({ query: 'answer', mode, agentSessionId: sessionId, folder: '/library/one' });
    assert.deepEqual(reached, ['/library/one', '/library/two', '/library/one']);
  });
}

test('Library Operations rejects stale or ambiguous attribution when no Folder was supplied', async (t) => {
  const { registerAttributedAgentSession, unregisterAttributedAgentSession } = await import('../agent-session-registry.ts');
  const operations = createLibraryOperations({ normalizeSearchScope: normalizeFolder });
  await assert.rejects(operations.search({ query: 'answer', agentSessionId: 'retired-session' }), /session is no longer available/);
  for (const id of ['scope-first', 'scope-second']) {
    registerAttributedAgentSession(id, {
      agentId: 'claude', windowId: 'shared-window', boundFolder: () => `/library/${id}`,
      isLibraryScoped: () => false, turnInFlight: () => true, nativeSessionId: () => null,
      similaritySearchEnabled: () => true, rebindToFolder: () => false,
    });
    t.after(() => unregisterAttributedAgentSession(id));
  }
  await assert.rejects(operations.search({ query: 'answer', windowId: 'shared-window' }), /ambiguous/);
});
