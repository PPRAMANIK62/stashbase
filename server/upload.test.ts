import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-${label}-`));
}

const home = tmpDir('upload-home');
process.env.HOME = home;
process.env.STASHBASE_LOCAL_DATA_ROOT = path.join(home, 'app-data');

const upload = await import('./routes/upload.ts');

function fakeFile(originalname: string): Express.Multer.File {
  return { originalname } as Express.Multer.File;
}

test('computeFinalNames deduplicates repeated nested final paths', async () => {
  const names = upload.computeFinalNames(
    [fakeFile('a.md'), fakeFile('b.md')],
    ['folder/note.md', 'folder/note.md'],
    '',
    () => false,
  );

  assert.deepEqual(names, ['folder/note.md', 'folder/note-2.md']);
});

test('computeFinalNames avoids existing nested files as a final fallback', async () => {
  const names = upload.computeFinalNames(
    [fakeFile('a.md')],
    ['folder/note.md'],
    '',
    (rel) => rel === 'folder',
  );

  assert.deepEqual(names, ['folder-2/note.md']);
});

test('validateUploadPath refuses local stashbase state and excluded directories', () => {
  assert.throws(
    () => upload.validateUploadPath('.stashbase/config.json'),
    /cannot write into \.stashbase/,
  );
  assert.throws(
    () => upload.validateUploadPath('.stashbase-2/config.json'),
    /cannot write into \.stashbase/,
  );
  assert.throws(
    () => upload.validateUploadPath('project/node_modules/pkg/index.js'),
    /excluded directory "node_modules"/,
  );
});

test('validateUploadPath refuses iCloud placeholder files', () => {
  assert.throws(
    () => upload.validateUploadPath('.note.md.icloud'),
    /iCloud placeholder/,
  );
  assert.throws(
    () => upload.validateUploadPath('folder/photo.jpg.icloud'),
    /iCloud placeholder/,
  );
});

test('upload helpers refuse paths that escape through symlink directories', { skip: process.platform === 'win32' }, () => {
  const root = tmpDir('upload-space');
  const external = tmpDir('upload-external');
  fs.writeFileSync(path.join(external, 'outside.md'), '# outside\n');
  fs.symlinkSync(external, path.join(root, 'linked'), 'dir');

  assert.equal(upload.__pathExistsInSpaceForTest(root, 'linked/outside.md'), false);
  assert.throws(
    () => upload.__saveBytesInSpaceForTest(root, 'linked/new.md', Buffer.from('# no\n')),
    /escapes space through symlink/,
  );
  assert.equal(fs.existsSync(path.join(external, 'new.md')), false);
});
