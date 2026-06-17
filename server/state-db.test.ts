import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-${label}-`));
}

const home = tmpDir('state-db-home');
process.env.HOME = home;
process.env.STASHBASE_LOCAL_DATA_ROOT = path.join(home, 'app-data');

async function openKbRoot(label: string): Promise<void> {
  const { setKbRoot } = await import('./space.ts');
  const kbRoot = tmpDir(`${label}-kb`);
  await setKbRoot(kbRoot, { allowNonEmpty: true });
}

async function createKbRoot(label: string): Promise<string> {
  const { setKbRoot } = await import('./space.ts');
  const kbRoot = tmpDir(`${label}-kb`);
  await setKbRoot(kbRoot, { allowNonEmpty: true });
  return kbRoot;
}

test('renameSpaceState carries conversion failures to the new space prefix', async () => {
  await openKbRoot('rename-space-state');
  const {
    readConversionStatusMap,
    renameSpaceState,
    setConversionStatus,
  } = await import('./state-db.ts');

  setConversionStatus('Old/paper.pdf', 'failed', { error: 'OCR failed', incrementAttempts: true });
  setConversionStatus('Old/nested/scan.png', 'failed', { error: 'image failed', incrementAttempts: true });
  setConversionStatus('Other/keep.pdf', 'failed', { error: 'keep', incrementAttempts: true });

  renameSpaceState('Old', 'New');

  const rows = readConversionStatusMap();
  assert.equal(rows['Old/paper.pdf'], undefined);
  assert.equal(rows['Old/nested/scan.png'], undefined);
  assert.equal(rows['New/paper.pdf']?.lastError, 'OCR failed');
  assert.equal(rows['New/nested/scan.png']?.lastError, 'image failed');
  assert.equal(rows['Other/keep.pdf']?.lastError, 'keep');
});

test('deleteSpaceState removes only the requested space prefix', async () => {
  await openKbRoot('delete-space-state');
  const {
    deleteSpaceState,
    readConversionStatusMap,
    setConversionStatus,
  } = await import('./state-db.ts');

  setConversionStatus('Alpha/paper.pdf', 'failed', { error: 'drop', incrementAttempts: true });
  setConversionStatus('Alphabet/paper.pdf', 'failed', { error: 'keep', incrementAttempts: true });

  deleteSpaceState('Alpha');

  const rows = readConversionStatusMap();
  assert.equal(rows['Alpha/paper.pdf'], undefined);
  assert.equal(rows['Alphabet/paper.pdf']?.lastError, 'keep');
});

test('clearConversionStatusUnder removes exact path and descendants only', async () => {
  await openKbRoot('delete-conversion-prefix');
  const {
    clearConversionStatusUnder,
    readConversionStatusMap,
    setConversionStatus,
  } = await import('./state-db.ts');

  setConversionStatus('Project/docs', 'failed', { error: 'drop exact', incrementAttempts: true });
  setConversionStatus('Project/docs/paper.pdf', 'failed', { error: 'drop child', incrementAttempts: true });
  setConversionStatus('Project/docs-other/paper.pdf', 'failed', { error: 'keep sibling', incrementAttempts: true });

  clearConversionStatusUnder('Project/docs/');

  const rows = readConversionStatusMap();
  assert.equal(rows['Project/docs'], undefined);
  assert.equal(rows['Project/docs/paper.pdf'], undefined);
  assert.equal(rows['Project/docs-other/paper.pdf']?.lastError, 'keep sibling');
});

test('legacy state db migration copies failed conversions into app data', async () => {
  const kbRoot = await createKbRoot('legacy-state-db');
  const stash = path.join(kbRoot, '.stashbase');
  fs.mkdirSync(stash, { recursive: true });
  const legacy = path.join(stash, 'state.db');
  const legacyDb = new Database(legacy);
  legacyDb.exec(`
    CREATE TABLE conversions (
      path TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      last_attempt_at TEXT NOT NULL,
      done_at TEXT
    );
  `);
  legacyDb.prepare(`
    INSERT INTO conversions (path, status, attempts, last_error, last_attempt_at, done_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('Project/failed.pdf', 'failed', 2, 'extract failed', '2026-01-01T00:00:00.000Z', null);
  legacyDb.prepare(`
    INSERT INTO conversions (path, status, attempts, last_error, last_attempt_at, done_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('Project/done.pdf', 'done', 1, null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:01:00.000Z');
  legacyDb.close();

  const { readConversionStatusMap } = await import('./state-db.ts');
  const { stateDbPathForKb } = await import('./local-data.ts');
  const rows = readConversionStatusMap();

  assert.deepEqual(Object.keys(rows), ['Project/failed.pdf']);
  assert.equal(rows['Project/failed.pdf']?.lastError, 'extract failed');
  assert.equal(fs.existsSync(stateDbPathForKb(kbRoot)), true);
  assert.equal(fs.existsSync(legacy), false);
});

test('legacy state db rows merge even when the app-data db already exists', async () => {
  const kbRoot = await createKbRoot('legacy-state-db-existing-target');
  const {
    closeStateDb,
    readConversionStatusMap,
    setConversionStatus,
  } = await import('./state-db.ts');
  const { stateDbPathForKb } = await import('./local-data.ts');

  setConversionStatus('Project/existing.pdf', 'failed', { error: 'keep', incrementAttempts: true });
  assert.equal(fs.existsSync(stateDbPathForKb(kbRoot)), true);
  closeStateDb();

  const stash = path.join(kbRoot, '.stashbase');
  fs.mkdirSync(stash, { recursive: true });
  const legacy = path.join(stash, 'state.db');
  const legacyDb = new Database(legacy);
  legacyDb.exec(`
    CREATE TABLE conversions (
      path TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      last_attempt_at TEXT NOT NULL,
      done_at TEXT
    );
  `);
  legacyDb.prepare(`
    INSERT INTO conversions (path, status, attempts, last_error, last_attempt_at, done_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('Project/legacy.pdf', 'failed', 3, 'legacy failed', '2026-01-02T00:00:00.000Z', null);
  legacyDb.close();

  const rows = readConversionStatusMap();

  assert.equal(rows['Project/existing.pdf']?.lastError, 'keep');
  assert.equal(rows['Project/legacy.pdf']?.lastError, 'legacy failed');
  assert.equal(fs.existsSync(legacy), false);
});

test('legacy conversion status migration keeps only failed rows after restart', async () => {
  const kbRoot = await createKbRoot('legacy-conversion-status');
  const stash = path.join(kbRoot, '.stashbase');
  fs.mkdirSync(stash, { recursive: true });
  fs.writeFileSync(path.join(stash, 'pdf-status.json'), JSON.stringify({
    'Project/running.pdf': {
      status: 'in-flight',
      attempts: 1,
      lastAttemptAt: '2026-01-01T00:00:00.000Z',
    },
    'Project/done.pdf': {
      status: 'done',
      attempts: 1,
      lastAttemptAt: '2026-01-01T00:00:00.000Z',
      doneAt: '2026-01-01T00:01:00.000Z',
    },
    'Project/cancelled.pdf': {
      status: 'cancelled',
      attempts: 1,
      lastAttemptAt: '2026-01-01T00:00:00.000Z',
    },
    'Project/failed.pdf': {
      status: 'failed',
      attempts: 2,
      lastError: 'extract failed',
      lastAttemptAt: '2026-01-01T00:00:00.000Z',
    },
  }), 'utf8');

  const { readConversionStatusMap } = await import('./state-db.ts');
  const rows = readConversionStatusMap();

  assert.deepEqual(Object.keys(rows), ['Project/failed.pdf']);
  assert.equal(rows['Project/failed.pdf']?.status, 'failed');
  assert.equal(rows['Project/failed.pdf']?.lastError, 'extract failed');
  assert.equal(fs.existsSync(path.join(stash, 'pdf-status.json.migrated')), true);
});
