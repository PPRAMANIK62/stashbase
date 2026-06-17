import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-${label}-`));
}

const home = tmpDir('files-home');
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

test('renameOnDisk refuses to overwrite an existing file', async () => {
  await openTestSpace('rename-overwrite');
  files.saveText('source.md', '# source\n');
  files.saveText('target.md', '# target\n');

  assert.throws(
    () => files.renameOnDisk('source.md', 'target.md'),
    /target already exists/,
  );

  assert.equal(files.readText('source.md'), '# source\n');
  assert.equal(files.readText('target.md'), '# target\n');
});

test('deleteFolder reports false when the folder is already gone', async () => {
  await openTestSpace('delete-folder-missing');

  assert.equal(files.deleteFolder('missing'), false);
});

test('deleteFolder reports true only when it removed an existing folder', async () => {
  await openTestSpace('delete-folder-present');
  files.createFolder('notes');
  files.saveText('notes/a.md', '# A\n');

  assert.equal(files.deleteFolder('notes'), true);
  assert.equal(files.pathExists('notes'), false);
});

test('deleteFile removes current and legacy PDF derived artifacts', async () => {
  await openTestSpace('delete-pdf-derived');
  files.saveBytes('paper.pdf', Buffer.from('%PDF-1.7\n'));
  files.saveText('.paper.pdf.md', '# current extract\n');
  files.saveBytes('.paper.pdf_files/page.png', Buffer.from('png'));
  files.saveText('.paper.md', '# legacy extract\n');
  files.saveBytes('.paper_files/page.png', Buffer.from('png'));

  assert.equal(files.deleteFile('paper.pdf'), true);

  assert.equal(files.pathExists('paper.pdf'), false);
  assert.equal(files.pathExists('.paper.pdf.md'), false);
  assert.equal(files.pathExists('.paper.pdf_files'), false);
  assert.equal(files.pathExists('.paper.md'), false);
  assert.equal(files.pathExists('.paper_files'), false);
});

test('deleteFile removes current and legacy image OCR notes', async () => {
  await openTestSpace('delete-image-derived');
  files.saveBytes('shot.png', Buffer.from('png'));
  files.saveText('.shot.png.md', '# current OCR\n');
  files.saveText('.shot.md', '# legacy OCR\n');

  assert.equal(files.deleteFile('shot.png'), true);

  assert.equal(files.pathExists('shot.png'), false);
  assert.equal(files.pathExists('.shot.png.md'), false);
  assert.equal(files.pathExists('.shot.md'), false);
});

test('renameOnDisk moves current PDF derived artifacts with the source', async () => {
  await openTestSpace('rename-pdf-derived');
  files.saveBytes('paper.pdf', Buffer.from('%PDF-1.7\n'));
  files.saveText('.paper.pdf.md', '# current extract\n');
  files.saveBytes('.paper.pdf_files/page.png', Buffer.from('png'));
  files.saveText('.paper.md', '# legacy extract\n');

  files.renameOnDisk('paper.pdf', 'archive/paper.pdf');

  assert.equal(files.pathExists('paper.pdf'), false);
  assert.equal(files.pathExists('.paper.pdf.md'), false);
  assert.equal(files.pathExists('.paper.pdf_files'), false);
  assert.equal(files.pathExists('.paper.md'), false);
  assert.equal(files.pathExists('archive/paper.pdf'), true);
  assert.equal(files.readText('archive/.paper.pdf.md'), '# current extract\n');
  assert.equal(files.pathExists('archive/.paper.pdf_files/page.png'), true);
});

test('renameOnDisk moves image OCR notes with the source', async () => {
  await openTestSpace('rename-image-derived');
  files.saveBytes('shot.png', Buffer.from('png'));
  files.saveText('.shot.png.md', '# current OCR\n');
  files.saveText('.shot.md', '# legacy OCR\n');

  files.renameOnDisk('shot.png', 'captures/shot.png');

  assert.equal(files.pathExists('shot.png'), false);
  assert.equal(files.pathExists('.shot.png.md'), false);
  assert.equal(files.pathExists('.shot.md'), false);
  assert.equal(files.pathExists('captures/shot.png'), true);
  assert.equal(files.readText('captures/.shot.png.md'), '# current OCR\n');
});

test('listIndexableTextFilesUnder includes hidden derived notes for folder index renames', async () => {
  await openTestSpace('list-indexable-derived');
  files.saveText('docs/a.md', '# A\n');
  files.saveBytes('docs/paper.pdf', Buffer.from('%PDF-1.7\n'));
  files.saveText('docs/.paper.pdf.md', '# extracted\n');
  files.saveText('docs/.paper.md', '# legacy extracted\n');
  files.saveBytes('docs/.paper.pdf_files/page.png', Buffer.from('png'));

  assert.deepEqual(
    files.listFiles().map((f) => f.name).filter((name) => name.startsWith('docs/')),
    ['docs/a.md', 'docs/paper.pdf'],
  );
  assert.deepEqual(
    files.listIndexableTextFilesUnder('docs').map((f) => f.name),
    ['docs/.paper.md', 'docs/.paper.pdf.md', 'docs/a.md'],
  );
});

test('file listing and folder index rename skip iCloud placeholder files', async () => {
  const root = await openTestSpace('icloud-placeholders');
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  files.saveText('docs/a.md', '# A\n');
  fs.writeFileSync(path.join(root, 'docs', '.remote.md.icloud'), 'placeholder');
  fs.writeFileSync(path.join(root, 'docs', 'paper.pdf.icloud'), 'placeholder');

  assert.deepEqual(
    files.listFiles().map((f) => f.name).filter((name) => name.startsWith('docs/')),
    ['docs/a.md'],
  );
  assert.deepEqual(
    files.listIndexableTextFilesUnder('docs').map((f) => f.name),
    ['docs/a.md'],
  );
});

test('file operations refuse paths that escape through symlink directories', { skip: process.platform === 'win32' }, async () => {
  const root = await openTestSpace('symlink-escape');
  const external = tmpDir('files-external');
  fs.writeFileSync(path.join(external, 'outside.md'), '# outside\n');
  fs.mkdirSync(path.join(external, 'folder'));
  fs.symlinkSync(external, path.join(root, 'linked'), 'dir');

  assert.equal(files.readText('linked/outside.md'), null);
  assert.equal(files.pathExists('linked/outside.md'), false);
  assert.equal(files.resolveAsset('linked/outside.md'), null);

  assert.throws(
    () => files.saveText('linked/new.md', '# should not write outside\n'),
    /escapes space through symlink/,
  );
  assert.equal(fs.existsSync(path.join(external, 'new.md')), false);

  assert.throws(
    () => files.createFolder('linked/new-folder'),
    /escapes space through symlink/,
  );
  assert.equal(fs.existsSync(path.join(external, 'new-folder')), false);

  assert.throws(
    () => files.deleteFolder('linked/folder'),
    /escapes space through symlink/,
  );
  assert.equal(fs.existsSync(path.join(external, 'folder')), true);

  assert.throws(
    () => files.listIndexableTextFilesUnder('linked'),
    /escapes space through symlink/,
  );
});
