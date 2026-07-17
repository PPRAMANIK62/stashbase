import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

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

  const status = await import('./conversion-status.ts');
  const source = process.platform === 'win32'
    ? 'C:/Users/Alice/Folder/Report.docx'
    : path.join(temp, 'Folder', 'Report.docx');
  const variant = process.platform === 'win32'
    ? 'c:\\users\\alice\\folder\\REPORT.docx'
    : source;
  const folderVariant = process.platform === 'win32'
    ? 'c:\\USERS\\ALICE\\FOLDER'
    : path.dirname(source);

  status.markInFlight(source);
  status.setProgress(variant, { phase: 'indexing' });
  assert.deepEqual(status.readProgress(source), { phase: 'indexing' });
  status.markFailed(variant, 'fixture failure');
  assert.equal(status.isPendingOrFailed(source), true);
  assert.equal(status.listFailed()[0]?.path, variant.replace(/\\/g, '/'));

  status.clearRecordsUnder(folderVariant);
  assert.equal(status.isPendingOrFailed(source), false);
  assert.deepEqual(status.listFailed(), []);
});
