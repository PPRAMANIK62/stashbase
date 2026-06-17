import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-${label}-`));
}

const home = tmpDir('indexing-recovery-home');
process.env.HOME = home;
process.env.STASHBASE_LOCAL_DATA_ROOT = path.join(home, 'app-data');

const space = await import('./space.ts');
const status = await import('./conversion-status.ts');
const indexing = await import('./routes/indexing.ts');

async function openTwoSpaces(label: string): Promise<{ kbRoot: string; alpha: string; beta: string }> {
  const kbRoot = tmpDir(`${label}-kb`);
  const alpha = path.join(kbRoot, 'Alpha');
  const beta = path.join(kbRoot, 'Beta');
  fs.mkdirSync(alpha, { recursive: true });
  fs.mkdirSync(beta, { recursive: true });
  await space.setKbRoot(kbRoot, { allowNonEmpty: true });
  return { kbRoot, alpha, beta };
}

test('conversion failure listing clears rows whose source file is gone', async () => {
  const { alpha } = await openTwoSpaces('failure-list-cleanup');
  fs.writeFileSync(path.join(alpha, 'present.pdf'), '%PDF-1.7\n');
  status.markFailed('Alpha/present.pdf', 'present failed');
  status.markFailed('Alpha/missing.pdf', 'missing failed');
  status.markFailed('Beta/other.pdf', 'other failed');

  const failures = indexing.conversionFailuresForSpace('Alpha');

  assert.deepEqual(failures, [
    { path: 'present.pdf', lastError: 'present failed', attempts: 1 },
  ]);
  assert.equal(status.readAll()['Alpha/missing.pdf'], undefined);
  assert.equal(status.readAll()['Beta/other.pdf']?.lastError, 'other failed');
});

test('conversion retry uses explicit space instead of the current window space', async () => {
  await openTwoSpaces('retry-explicit-space');
  status.markFailed('Alpha/missing.pdf', 'alpha failed');
  status.markFailed('Beta/missing.pdf', 'beta failed');

  assert.throws(
    () => indexing.retryConversionInSpace('missing.pdf', 'Alpha'),
    /file not found/,
  );

  assert.equal(status.readAll()['Alpha/missing.pdf'], undefined);
  assert.equal(status.readAll()['Beta/missing.pdf']?.lastError, 'beta failed');
});

test('in-flight conversion listing can target an explicit non-current space', async () => {
  await openTwoSpaces('inflight-explicit-space');
  status.markInFlight('Alpha/paper.pdf');
  status.markInFlight('Beta/shot.png');
  try {
    const { getInFlightConversions } = await import('./conversion.ts');

    assert.deepEqual(getInFlightConversions('Alpha'), ['paper.pdf']);
    assert.deepEqual(getInFlightConversions('Beta'), ['shot.png']);
  } finally {
    status.clearRecord('Alpha/paper.pdf');
    status.clearRecord('Beta/shot.png');
  }
});

test('snapshot meta helper records descriptor fields', () => {
  const meta = indexing.makeSnapshotMeta('Alpha', {
    path: '/tmp/snapshot.parquet',
    vectors: 12,
    chunks: 7,
    version: 3,
    embedder: { provider: 'openai', model: 'text-embedding-3-small', dim: 1536 },
  }, new Date('2026-01-02T03:04:05.000Z'));

  assert.deepEqual(meta, {
    version: 3,
    space: 'Alpha',
    embedder: { provider: 'openai', model: 'text-embedding-3-small', dim: 1536 },
    vectors: 12,
    chunks: 7,
    exported_at: '2026-01-02T03:04:05.000Z',
  });
});

test('snapshot export cleans orphan parquet when meta write fails', () => {
  const dir = tmpDir('snapshot-meta-cleanup');
  const snapshot = path.join(dir, 'snapshot.parquet');
  const metaPath = path.join(dir, 'meta-parent-is-file', 'snapshot.meta.json');
  fs.writeFileSync(snapshot, 'snapshot');
  fs.writeFileSync(path.join(dir, 'meta-parent-is-file'), 'not a directory');

  assert.throws(
    () => indexing.writeSnapshotMetaOrCleanup(metaPath, snapshot, indexing.makeSnapshotMeta('Alpha', {
      path: snapshot,
      vectors: 1,
      chunks: 1,
      version: 3,
      embedder: { provider: 'openai', model: null, dim: 1536 },
    })),
    /EEXIST|ENOTDIR|not a directory/i,
  );
  assert.equal(fs.existsSync(snapshot), false);
});
