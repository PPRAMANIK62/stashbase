import assert from 'node:assert/strict';
import test from 'node:test';

import { semanticSearchRequestSchema, semanticSearchResponseSchema } from './semantic-search.ts';

test('semantic search hits carry a folder-qualified identity beside the compatibility name', () => {
  const parsed = semanticSearchResponseSchema.parse({
    hits: [
      {
        chunkIndex: 2,
        content: 'Chunk body',
        fileName: '/library/research/papers/report.pdf',
        folder: '/library/research',
        heading: 'Intro › Method',
        path: 'papers/report.pdf',
        pdfPage: 3,
        score: 0.42,
      },
    ],
    truncated: true,
  });
  assert.equal(parsed.hits[0]?.path, 'papers/report.pdf');
  assert.equal(parsed.hits[0]?.folder, '/library/research');
});

test('semantic search requires the semantic mode and a bounded top_k', () => {
  assert.equal(
    semanticSearchRequestSchema.safeParse({ mode: 'semantic', query: 'idea', top_k: 30 }).success,
    true,
  );
  assert.equal(
    semanticSearchRequestSchema.safeParse({ mode: 'keyword', query: 'idea', top_k: 30 }).success,
    false,
  );
  assert.equal(
    semanticSearchRequestSchema.safeParse({ mode: 'semantic', query: 'idea', top_k: 0 }).success,
    false,
  );
  assert.equal(
    semanticSearchResponseSchema.safeParse({ hits: [{ chunkIndex: 0, content: '', fileName: 'x', heading: '', score: 1 }] }).success,
    false,
  );
});
