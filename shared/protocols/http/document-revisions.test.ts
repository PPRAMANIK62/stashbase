import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  documentRevisionsRequestSchema,
  documentRevisionsResponseSchema,
} from './document-revisions.ts';

const folder = '/home/reader/Notes';
const proposal = {
  id: 'proposal-1',
  path: '/home/reader/Notes/Draft.md',
  content: '# Draft\n\nRevised.\n',
  baseVersion: 'sha256:abc',
  origin: 'agent',
  createdAt: 1_700_000_000_000,
};

test('the drain request requires a folder and ignores anything else on the query', () => {
  assert.deepEqual(
    documentRevisionsRequestSchema.parse({ folder: ' /home/reader/Notes ', t: '42' }),
    { folder: '/home/reader/Notes' },
  );
  assert.equal(documentRevisionsRequestSchema.safeParse({}).success, false);
  assert.equal(documentRevisionsRequestSchema.safeParse({ folder: '   ' }).success, false);
});

test('a drained proposal carries the whole document and the version it was computed against', () => {
  assert.deepEqual(
    documentRevisionsResponseSchema.parse({ folder: folder, proposals: [proposal] }),
    { folder: folder, proposals: [proposal] },
  );
});

test('a proposal field this renderer has no reader for is dropped', () => {
  const parsed = documentRevisionsResponseSchema.parse({
    folder: folder,
    proposals: [{ ...proposal, changes: 3 }],
  });
  assert.equal('changes' in parsed.proposals[0], false);
});

test('an origin the renderer cannot route is refused rather than shown', () => {
  assert.equal(
    documentRevisionsResponseSchema.safeParse({
      folder: folder,
      proposals: [{ ...proposal, origin: 'stranger' }],
    }).success,
    false,
  );
});
