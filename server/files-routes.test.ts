import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-${label}-`));
}

const home = tmpDir('files-routes-home');
process.env.HOME = home;
process.env.STASHBASE_LOCAL_DATA_ROOT = path.join(home, 'app-data');

const space = await import('./space.ts');
const files = await import('./files.ts');

async function openTestSpace(label: string): Promise<string> {
  const kbRoot = tmpDir(`${label}-kb`);
  const spaceRoot = path.join(kbRoot, 'Project');
  fs.mkdirSync(spaceRoot, { recursive: true });
  await space.setKbRoot(kbRoot, { allowNonEmpty: true });
  space.setCurrentSpace(spaceRoot);
  return spaceRoot;
}

const initialSpaceRoot = await openTestSpace('files-routes');
const { fileHeadStatus, saveFileContent, inFlightFileOperationError, validateEditableFileWrite } = await import('./routes/files.ts');
const { inFlightFolderOperationError } = await import('./routes/folders.ts');
const { clearRecord, markInFlight } = await import('./conversion-status.ts');
const state = await import('./state.ts');

test.after(async () => {
  await state.indexer.close();
});

test('saveFileContent saves unload beacon content and bumps tree version', async () => {
  const watcher = await import('./watcher.ts');
  const before = watcher.getFsChangeCounter();

  await saveFileContent('beacon.md', '# Saved on unload\n');

  assert.equal(files.readText('beacon.md'), '# Saved on unload\n');
  assert.equal(watcher.getFsChangeCounter(), before + 1);
});

test('saveFileContent rejects stale versions instead of overwriting newer disk content', async () => {
  const first = await saveFileContent('note.md', 'first\n');
  await saveFileContent('note.md', 'newer external content\n', { baseVersion: first.version });

  await assert.rejects(
    () => saveFileContent('note.md', 'old tab content\n', { baseVersion: first.version }),
    (err: unknown) => {
      assert.equal((err as { code?: string }).code, 'FILE_CHANGED');
      return true;
    },
  );
  assert.equal(files.readText('note.md'), 'newer external content\n');
});

test('saveFileContent detects same-size external edits that preserve mtime', async () => {
  const first = await saveFileContent('same-size.md', 'aaaa\n');
  const file = path.join(initialSpaceRoot, 'same-size.md');
  const before = fs.statSync(file);
  fs.writeFileSync(file, 'bbbb\n');
  fs.utimesSync(file, before.atime, before.mtime);

  await assert.rejects(
    () => saveFileContent('same-size.md', 'cccc\n', { baseVersion: first.version }),
    (err: unknown) => {
      assert.equal((err as { code?: string }).code, 'FILE_CHANGED');
      return true;
    },
  );
  assert.equal(files.readText('same-size.md'), 'bbbb\n');
});

test('saveFileContent with a stale version does not recreate a deleted file', async () => {
  const first = await saveFileContent('deleted.md', 'first\n');
  files.deleteFile('deleted.md');

  await assert.rejects(
    () => saveFileContent('deleted.md', 'old tab content\n', { baseVersion: first.version }),
    /file changed on disk/,
  );
  assert.equal(files.readText('deleted.md'), null);
});

test('saveFileContent only writes editable visible note formats', async () => {
  assert.throws(
    () => validateEditableFileWrite('paper.pdf'),
    (err: unknown) => {
      assert.equal((err as { status?: number }).status, 415);
      assert.equal((err as { code?: string }).code, 'UNSUPPORTED_FORMAT');
      return true;
    },
  );
  assert.throws(
    () => validateEditableFileWrite('.stashbase/config.json'),
    /cannot write into \.stashbase/,
  );
  assert.throws(
    () => validateEditableFileWrite('node_modules/pkg/note.md'),
    /excluded directory "node_modules"/,
  );
  assert.throws(
    () => validateEditableFileWrite('.paper.pdf.md'),
    /derived notes/,
  );
  assert.throws(
    () => validateEditableFileWrite('note.md.icloud'),
    /iCloud placeholder/,
  );
  assert.equal(validateEditableFileWrite('docs/note.md'), undefined);
  assert.equal(validateEditableFileWrite('docs/page.html'), undefined);
});

test('fileHeadStatus accepts viewer files without reading binary bodies', async () => {
  fs.writeFileSync(path.join(initialSpaceRoot, 'paper.pdf'), '%PDF-1.7\n');
  fs.writeFileSync(path.join(initialSpaceRoot, 'shot.png'), 'png');

  assert.equal(fileHeadStatus('paper.pdf'), 204);
  assert.equal(fileHeadStatus('shot.png'), 204);
  assert.equal(fileHeadStatus('missing.pdf'), 404);
  assert.equal(fileHeadStatus('archive.zip'), 415);
});

test('file route helpers reject rename but allow delete while conversion is in flight', async () => {
  const kbRel = space.toKbRel('paper.pdf');
  markInFlight(kbRel);
  try {
    assert.deepEqual(inFlightFileOperationError('paper.pdf', 'rename'), {
      status: 409,
      body: {
        error: 'This file is still processing. Rename it after processing finishes.',
        code: 'CONVERSION_IN_FLIGHT',
      },
    });
    assert.equal(inFlightFileOperationError('paper.pdf', 'delete'), null);
    assert.equal(inFlightFileOperationError('other.pdf', 'delete'), null);
  } finally {
    clearRecord(kbRel);
  }
});

test('folder route helpers reject rename and delete when a child conversion is in flight', async () => {
  const kbRel = space.toKbRel('docs/paper.pdf');
  markInFlight(kbRel);
  try {
    assert.deepEqual(inFlightFolderOperationError('docs', 'rename'), {
      status: 409,
      body: {
        error: 'This folder contains files that are still processing. Rename it after processing finishes.',
        code: 'CONVERSION_IN_FLIGHT',
      },
    });
    assert.deepEqual(inFlightFolderOperationError('docs', 'delete'), {
      status: 409,
      body: {
        error: 'This folder contains files that are still processing. Delete it after processing finishes.',
        code: 'CONVERSION_IN_FLIGHT',
      },
    });
    assert.equal(inFlightFolderOperationError('doc', 'delete'), null);
  } finally {
    clearRecord(kbRel);
  }
});
