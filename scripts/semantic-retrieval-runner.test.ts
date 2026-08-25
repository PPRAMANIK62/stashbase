import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { SemanticEvalDataset } from './semantic-retrieval-dataset.ts';
import { CHUNK_FETCH_MULTIPLIER, runSemanticRetrievalEval, semanticEvalExitCode, type SemanticEvalBackend } from './semantic-retrieval-runner.ts';

async function runnerFixture(): Promise<{ root: string; datasetRoot: string; dataset: SemanticEvalDataset }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'stashbase-eval-runner-'));
  const datasetRoot = path.join(root, 'dataset');
  await fs.mkdir(path.join(datasetRoot, 'corpus'), { recursive: true });
  await fs.mkdir(path.join(datasetRoot, 'prepared'), { recursive: true });
  await fs.writeFile(path.join(datasetRoot, 'corpus/direct.md'), 'direct fixture');
  await fs.writeFile(path.join(datasetRoot, 'corpus/source.pdf'), '%PDF synthetic');
  await fs.writeFile(path.join(datasetRoot, 'prepared/source.md'), 'prepared evidence');
  return {
    root,
    datasetRoot,
    dataset: {
      schemaVersion: 1,
      datasetVersion: 'runner-smoke-v1',
      topK: 1,
      thresholds: { recallAtK: 1, meanReciprocalRank: 1 },
      baselinePolicy: { minimumRunsPerProvider: 2, providers: ['fake-provider'] },
      baselineRuns: [],
      documents: [
        { path: 'corpus/direct.md', kind: 'direct' },
        { path: 'corpus/source.pdf', kind: 'prepared', preparedText: 'prepared/source.md' },
      ],
      queries: [
        { id: 'direct', text: 'direct question', relevant: ['corpus/direct.md'], compareExact: true },
        { id: 'prepared', text: 'prepared question', relevant: ['corpus/source.pdf'] },
      ],
    },
  };
}

test('runner stages direct and prepared evidence, reports results, and cleans isolated state', async (t) => {
  const fixture = await runnerFixture();
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  const scratch = path.join(fixture.root, 'scratch');
  const indexed: string[] = [];
  const chunkBudgets: number[] = [];
  let closed = false;
  let observedAppData = '';
  const result = await runSemanticRetrievalEval({
    dataset: fixture.dataset,
    datasetRoot: fixture.datasetRoot,
    provider: 'fake-provider',
    model: 'fake-model',
    commit: 'abc123',
    makeScratch: async () => { await fs.mkdir(scratch); return scratch; },
    async createBackend({ libraryRoot, appDataRoot }): Promise<SemanticEvalBackend> {
      observedAppData = appDataRoot;
      return {
        bind: async () => {},
        indexDirect: async (source) => { indexed.push(path.basename(source)); },
        indexPrepared: async (source, prepared, hash) => {
          indexed.push(`${path.basename(source)}:${prepared}:${hash.length > 0}`);
        },
        semanticSearch: async (query, chunkBudget) => {
          chunkBudgets.push(chunkBudget);
          return [path.join(libraryRoot, query.startsWith('direct') ? 'corpus/direct.md' : 'corpus/source.pdf')];
        },
        exactSearch: async () => [],
        close: async () => { closed = true; },
      };
    },
  });
  assert.equal(result.passed, true);
  assert.equal(result.gateReady, false);
  assert.match(result.report, /Gate status: CALIBRATION/);
  assert.match(result.report, /Provider: fake-provider/);
  assert.match(result.report, /Commit: abc123/);
  assert.match(result.report, /exact: \(no results\)/);
  assert.deepEqual(indexed[0], 'direct.md');
  assert.match(indexed[1] ?? '', /^source\.pdf:prepared evidence:true$/);
  assert.equal(observedAppData, path.join(scratch, 'app-data'));
  // The index is asked for chunks, not documents; the runner collapses them.
  assert.deepEqual(chunkBudgets, [
    fixture.dataset.topK * CHUNK_FETCH_MULTIPLIER,
    fixture.dataset.topK * CHUNK_FETCH_MULTIPLIER,
  ]);
  assert.equal(closed, true);
  await assert.rejects(fs.stat(scratch));
});

test('runner collapses repeated chunk hits so K counts distinct sources', async (t) => {
  const fixture = await runnerFixture();
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  const result = await runSemanticRetrievalEval({
    dataset: { ...fixture.dataset, topK: 2 },
    datasetRoot: fixture.datasetRoot,
    provider: 'fake-provider',
    model: 'fake-model',
    commit: 'abc123',
    async createBackend({ libraryRoot }): Promise<SemanticEvalBackend> {
      // A long source returning three chunks must not consume three slots.
      const noise = path.join(libraryRoot, 'corpus/source.pdf');
      return {
        bind: async () => {}, indexDirect: async () => {}, indexPrepared: async () => {},
        semanticSearch: async (query) => (query.startsWith('direct')
          ? [noise, noise, noise, path.join(libraryRoot, 'corpus/direct.md')]
          : [noise, noise]),
        exactSearch: async () => [path.join(libraryRoot, 'corpus/direct.md'), path.join(libraryRoot, 'corpus/direct.md')],
        close: async () => {},
      };
    },
  });
  // Without collapsing, direct.md sits at chunk rank 4 and falls outside a
  // top-2 window; collapsed, it is the second distinct source.
  assert.equal(result.recallAtK, 1);
  assert.match(result.report, /\[rank 2\] direct/);
  assert.match(result.report, /exact: corpus\/direct\.md$/m);
});

test('runner surfaces a close failure when the run itself succeeded', async (t) => {
  const fixture = await runnerFixture();
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  const scratch = path.join(fixture.root, 'close-scratch');
  await assert.rejects(runSemanticRetrievalEval({
    dataset: fixture.dataset,
    datasetRoot: fixture.datasetRoot,
    provider: 'fake-provider',
    model: 'fake-model',
    commit: 'abc123',
    makeScratch: async () => { await fs.mkdir(scratch); return scratch; },
    async createBackend({ libraryRoot }): Promise<SemanticEvalBackend> {
      return {
        bind: async () => {}, indexDirect: async () => {}, indexPrepared: async () => {},
        semanticSearch: async (query) => [path.join(libraryRoot, query.startsWith('direct') ? 'corpus/direct.md' : 'corpus/source.pdf')],
        exactSearch: async () => [],
        close: async () => { throw new Error('daemon close failed'); },
      };
    },
  }), /daemon close failed/);
  await assert.rejects(fs.stat(scratch));
});

test('runner keeps the primary failure when close also fails', async (t) => {
  const fixture = await runnerFixture();
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  await assert.rejects(runSemanticRetrievalEval({
    dataset: fixture.dataset,
    datasetRoot: fixture.datasetRoot,
    provider: 'fake-provider',
    model: 'fake-model',
    commit: 'abc123',
    async createBackend(): Promise<SemanticEvalBackend> {
      return {
        bind: async () => {}, indexDirect: async () => {}, indexPrepared: async () => {},
        semanticSearch: async () => ['/outside/result.md'], exactSearch: async () => [],
        close: async () => { throw new Error('daemon close failed'); },
      };
    },
  }), /outside the evaluation library/);
});

test('runner marks a report produced from a dirty working tree', async (t) => {
  const fixture = await runnerFixture();
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  const result = await runSemanticRetrievalEval({
    dataset: fixture.dataset,
    datasetRoot: fixture.datasetRoot,
    provider: 'fake-provider',
    model: 'fake-model',
    commit: 'abc123',
    workingTreeDirty: true,
    async createBackend({ libraryRoot }): Promise<SemanticEvalBackend> {
      return {
        bind: async () => {}, indexDirect: async () => {}, indexPrepared: async () => {},
        semanticSearch: async (query) => [path.join(libraryRoot, query.startsWith('direct') ? 'corpus/direct.md' : 'corpus/source.pdf')],
        exactSearch: async () => [],
        close: async () => {},
      };
    },
  });
  assert.match(result.report, /Commit: abc123 \(DIRTY WORKING TREE/);
});

test('runner cleans scratch when backend initialization fails', async (t) => {
  const fixture = await runnerFixture();
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  const scratch = path.join(fixture.root, 'failed-scratch');
  await assert.rejects(runSemanticRetrievalEval({
    dataset: fixture.dataset,
    datasetRoot: fixture.datasetRoot,
    provider: 'fake-provider',
    model: 'fake-model',
    commit: 'abc123',
    makeScratch: async () => { await fs.mkdir(scratch); return scratch; },
    createBackend: async () => { throw new Error('backend failed'); },
  }), /backend failed/);
  await assert.rejects(fs.stat(scratch));
});

test('runner rejects retrieval sources outside the isolated library and still closes', async (t) => {
  const fixture = await runnerFixture();
  t.after(() => fs.rm(fixture.root, { recursive: true, force: true }));
  let closed = false;
  await assert.rejects(runSemanticRetrievalEval({
    dataset: fixture.dataset,
    datasetRoot: fixture.datasetRoot,
    provider: 'fake-provider',
    model: 'fake-model',
    commit: 'abc123',
    async createBackend(): Promise<SemanticEvalBackend> {
      return {
        bind: async () => {}, indexDirect: async () => {}, indexPrepared: async () => {},
        semanticSearch: async () => ['/outside/result.md'], exactSearch: async () => [],
        close: async () => { closed = true; },
      };
    },
  }), /outside the evaluation library/);
  assert.equal(closed, true);
});

test('exit status gates failures only after provider baselines are complete', () => {
  assert.equal(semanticEvalExitCode({ gateReady: false, passed: false }), 0);
  assert.equal(semanticEvalExitCode({ gateReady: true, passed: true }), 0);
  assert.equal(semanticEvalExitCode({ gateReady: true, passed: false }), 1);
});
