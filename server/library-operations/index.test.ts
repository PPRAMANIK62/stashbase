import assert from 'node:assert/strict';
import test from 'node:test';
import { LibraryOperationError, createLibraryOperations } from './index.ts';

test('Library Operations rejects semantic search without embedding configuration', async () => {
  const operations = createLibraryOperations({
    getLibraryInfo: () => ({ folder_home: '/library', folders: [] }),
    hasEmbeddingKey: () => false,
  });

  await assert.rejects(
    operations.search({ query: 'architecture' }),
    (error: unknown) => error instanceof LibraryOperationError
      && error.status === 412
      && error.code === 'EMBEDDER_KEY_REQUIRED',
  );
});

test('Library Operations keeps search result identity at the visible source path', async () => {
  const operations = createLibraryOperations({
    getLibraryInfo: () => ({ folder_home: '/library', folders: [] }),
    hasEmbeddingKey: () => true,
    search: async () => [{
      fileName: '/library/paper.pdf', chunkIndex: 0, content: 'derived evidence', heading: '', score: 1,
    }],
    remapSearchHits: (hits) => hits.map((hit) => ({ ...hit, fileName: '/library/paper.pdf' })),
  });

  assert.deepEqual(
    await operations.search({ query: 'paper', topK: 8 }),
    { hits: [{ fileName: '/library/paper.pdf', chunkIndex: 0, content: 'derived evidence', heading: '', score: 1 }] },
  );
});

test('Library Operations validates mutation fields before an adapter can write', async () => {
  const operations = createLibraryOperations({
    getLibraryInfo: () => ({ folder_home: '/library', folders: [] }),
  });

  await assert.rejects(
    operations.write({ path: '/library/note.md', content: undefined }),
    (error: unknown) => error instanceof LibraryOperationError && error.status === 400,
  );
});
