import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parseSemanticEvalDataset, resolveDatasetPath } from './semantic-retrieval-dataset.ts';

async function fixtureDataset(): Promise<{ root: string; raw: Record<string, unknown> }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'stashbase-eval-dataset-'));
  const documents = Array.from({ length: 10 }, (_, index) => ({ path: `corpus/${index}.md`, kind: 'direct' }));
  await fs.mkdir(path.join(root, 'corpus'), { recursive: true });
  await Promise.all(documents.map((document) => fs.writeFile(path.join(root, document.path), `fixture ${document.path}`)));
  const queries = Array.from({ length: 10 }, (_, index) => ({
    id: `q-${index}`,
    text: `query ${index}`,
    relevant: [`corpus/${index}.md`],
  }));
  return {
    root,
    raw: {
      schemaVersion: 1,
      datasetVersion: 'test-v1',
      topK: 3,
      thresholds: { recallAtK: 0.8, meanReciprocalRank: 0.7 },
      baselinePolicy: { minimumRunsPerProvider: 2, providers: ['openai', 'openrouter'] },
      baselineRuns: [],
      documents,
      queries,
    },
  };
}

test('dataset parser validates a complete manifest and its fixtures', async (t) => {
  const fixture = await fixtureDataset();
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  const parsed = await parseSemanticEvalDataset(fixture.raw, fixture.root);
  assert.equal(parsed.documents.length, 10);
  assert.equal(parsed.queries.length, 10);
});

test('dataset parser rejects duplicate IDs, judgments, unknown sources, and invalid thresholds', async (t) => {
  const fixture = await fixtureDataset();
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  const raw = structuredClone(fixture.raw) as any;
  raw.queries[1].id = raw.queries[0].id;
  await assert.rejects(parseSemanticEvalDataset(raw, fixture.root), /duplicate query id/);
  raw.queries[1].id = 'restored';
  raw.queries[0].relevant = ['corpus/0.md', 'corpus/0.md'];
  await assert.rejects(parseSemanticEvalDataset(raw, fixture.root), /judgments must be unique/);
  raw.queries[0].relevant = ['corpus/missing.md'];
  await assert.rejects(parseSemanticEvalDataset(raw, fixture.root), /not in the corpus/);
  raw.queries[0].relevant = ['corpus/0.md'];
  raw.thresholds.recallAtK = 2;
  await assert.rejects(parseSemanticEvalDataset(raw, fixture.root), /from 0 to 1/);
  raw.thresholds.recallAtK = 0.8;
  raw.baselineRuns = [
    { provider: 'unknown', model: 'm', runId: 'run-1', recordedAt: '2026-08-22', recallAtK: 1, meanReciprocalRank: 1, evidence: 'review/1' },
  ];
  await assert.rejects(parseSemanticEvalDataset(raw, fixture.root), /provider is not declared/);
});

test('dataset paths cannot escape their root and declared fixtures must exist', async (t) => {
  const fixture = await fixtureDataset();
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  assert.throws(() => resolveDatasetPath(fixture.root, '../secret.md'), /stay inside/);
  const raw = structuredClone(fixture.raw) as any;
  raw.documents[0].path = '../secret.md';
  await assert.rejects(parseSemanticEvalDataset(raw, fixture.root), /stay inside/);
  raw.documents[0].path = 'corpus/absent.md';
  raw.queries[0].relevant = ['corpus/absent.md'];
  await assert.rejects(parseSemanticEvalDataset(raw, fixture.root), /missing or not a file/);
});
