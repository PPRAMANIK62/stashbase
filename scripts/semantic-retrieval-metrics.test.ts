import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreRankedQueries } from './semantic-retrieval-metrics.ts';

test('semantic eval computes recall at K and reciprocal rank', () => {
  const result = scoreRankedQueries([
    { id: 'first', query: 'q1', relevant: ['a', 'b'], ranked: ['x', 'b', 'a'] },
    { id: 'miss', query: 'q2', relevant: ['c'], ranked: ['x', 'y'] },
  ], 2);

  assert.equal(result.queries[0]?.recallAtK, 0.5);
  assert.equal(result.queries[0]?.reciprocalRank, 0.5);
  assert.equal(result.queries[1]?.recallAtK, 0);
  assert.equal(result.recallAtK, 0.25);
  assert.equal(result.meanReciprocalRank, 0.25);
});

test('semantic eval rejects empty judgments and invalid K', () => {
  assert.throws(() => scoreRankedQueries([], 5), /at least one query/);
  assert.throws(
    () => scoreRankedQueries([{ id: 'bad', query: 'q', relevant: [], ranked: [] }], 5),
    /relevant must not be empty/,
  );
  assert.throws(
    () => scoreRankedQueries([{ id: 'bad', query: 'q', relevant: ['a'], ranked: [] }], 0),
    /topK must be a positive integer/,
  );
});

test('semantic eval refuses chunk-level rankings that repeat a source', () => {
  // Retrieval ranks chunks; a repeated source means the caller forgot to
  // collapse them and K would no longer count distinct documents.
  assert.throws(
    () => scoreRankedQueries([{ id: 'dup', query: 'q', relevant: ['a'], ranked: ['b', 'b', 'a'] }], 3),
    /collapsed to distinct sources/,
  );
});
