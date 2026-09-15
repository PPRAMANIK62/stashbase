import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { filesystemPath } from './filesystem-path.ts';


test('conversion progress and durable failures use filesystem path identity', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-status-path-'));
  const previousDataRoot = process.env.STASHBASE_LOCAL_DATA_ROOT;
  process.env.STASHBASE_LOCAL_DATA_ROOT = temp;
  t.after(async () => {
    const { closeStateDb } = await import('./state-db.ts');
    closeStateDb();
    if (previousDataRoot == null) delete process.env.STASHBASE_LOCAL_DATA_ROOT;
    else process.env.STASHBASE_LOCAL_DATA_ROOT = previousDataRoot;
    fs.rmSync(temp, { recursive: true, force: true });
  });

  const source = process.platform === 'win32'
    ? 'C:/Users/Alice/Folder/Report.docx'
    : path.join(temp, 'Folder', 'Report.docx');
  const variant = process.platform === 'win32'
    ? 'c:\\users\\alice\\folder\\REPORT.docx'
    : source;
  const folderVariant = process.platform === 'win32'
    ? 'c:\\USERS\\ALICE\\FOLDER'
    : path.dirname(source);

  const status = await import('./conversion-status.ts');

  status.markFailed(source, 'initial fixture failure');
  status.markInFlight(source);
  status.setProgress(variant, { phase: 'indexing' });
  assert.deepEqual(status.readProgress(source), { phase: 'indexing' });
  status.markFailed(variant, 'fixture failure');
  assert.equal(status.isPendingOrFailed(source), true);
  assert.equal(status.hasFailed(source), true);
  assert.equal(
    status.listFailed()[0]?.path,
    process.platform === 'win32' ? source : variant.replace(/\\/g, '/'),
  );
  assert.equal(status.listFailed()[0]?.entry.attempts, 2);

  status.markCancelled(source);
  assert.deepEqual(status.listFailed(), []);
  assert.equal(status.listPreparationProblems()[0]?.entry.status, 'cancelled');
  assert.equal(status.isPendingOrFailed(source), true);

  // Current explicit cancellation, unlike in-flight progress, is durable.
  const { closeStateDb, getConversionStatus } = await import('./state-db.ts');
  closeStateDb();
  assert.equal(getConversionStatus(variant)?.status, 'cancelled');

  status.clearRecordsUnder(folderVariant);
  assert.equal(status.isPendingOrFailed(source), false);
  assert.deepEqual(status.listFailed(), []);
});

test('unavailable status storage rejects cancellation and retries its durable write after repair', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-status-repair-'));
  const previous = process.env.STASHBASE_LOCAL_DATA_ROOT;
  process.env.STASHBASE_LOCAL_DATA_ROOT = temp;
  const { closeStateDb } = await import('./state-db.ts');
  const { appStateDbPath } = await import('./local-data.ts');
  const status = await import('./conversion-status.ts');
  t.after(() => {
    closeStateDb();
    if (previous === undefined) delete process.env.STASHBASE_LOCAL_DATA_ROOT;
    else process.env.STASHBASE_LOCAL_DATA_ROOT = previous;
    fs.rmSync(temp, { recursive: true, force: true });
  });
  closeStateDb();
  const database = appStateDbPath();
  fs.mkdirSync(path.dirname(database), { recursive: true });
  fs.writeFileSync(database, 'not a sqlite database');
  const source = path.join(temp, 'draft.pdf');
  assert.throws(() => status.markCancelled(source), /Preparation status/);
  assert.throws(() => status.isPendingOrFailed(source), /Preparation status/);
  fs.rmSync(database);
  assert.equal(status.isPendingOrFailed(source), true);
  closeStateDb();
  assert.equal(status.readAll()[filesystemPath.absolute(source)]?.status, 'cancelled');
  status.clearRecord(source);
  assert.equal(status.isPendingOrFailed(source), false);
});
