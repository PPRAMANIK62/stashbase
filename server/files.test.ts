import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { saveFileContent, validateEditableFileWrite } from './file-save.ts';
import { runWithFolderRoot } from './folder.ts';
import {
  createFolder,
  deleteFile,
  isSameExistingPath,
  listFiles,
  listFolders,
  listIndexableTextFilesUnder,
  readEditableText,
  readText,
  renameFolder,
  renameOnDisk,
  saveText,
  sanitizeFilename,
} from './files.ts';

test('renameOnDisk supports case-only file renames', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-case-rename-'));
  try {
    fs.writeFileSync(path.join(root, 'note.md'), 'hello');

    await runWithFolderRoot(root, async () => {
      const targetExistsBeforeRename = fs.existsSync(path.join(root, 'Note.md'));
      if (targetExistsBeforeRename) {
        assert.equal(isSameExistingPath('note.md', 'Note.md'), true);
      }

      renameOnDisk('note.md', 'Note.md');
    });

    assert.deepEqual(fs.readdirSync(root), ['Note.md']);
    assert.equal(fs.readFileSync(path.join(root, 'Note.md'), 'utf8'), 'hello');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('renameFolder supports case-only folder renames', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-case-folder-'));
  try {
    fs.mkdirSync(path.join(root, 'folder'));
    fs.writeFileSync(path.join(root, 'folder', 'note.md'), 'hello');

    await runWithFolderRoot(root, () => renameFolder('folder', 'Folder'));

    assert.deepEqual(fs.readdirSync(root), ['Folder']);
    assert.equal(fs.readFileSync(path.join(root, 'Folder', 'note.md'), 'utf8'), 'hello');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('quoted imported filenames remain readable, writable, and deletable', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-quoted-file-'));
  try {
    const name = "John's Notes.md";
    fs.writeFileSync(path.join(root, name), 'hello');

    await runWithFolderRoot(root, () => {
      assert.equal(readText(name), 'hello');
      saveText(name, 'updated');
      assert.equal(readText(name), 'updated');
      assert.equal(deleteFile(name), true);
      assert.equal(readText(name), null);
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('editable markdown preserves BOM and CRLF while presenting canonical editor text', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-source-format-'));
  const source = path.join(root, 'note.md');
  const original = Buffer.from('\uFEFF---\r\ntitle: test\r\n---\r\n\r\n<div data-x="raw">broken *markdown\r\n::: unsupported-extension\r\n', 'utf8');
  try {
    fs.writeFileSync(source, original);
    await runWithFolderRoot(root, async () => {
      assert.equal(
        readEditableText('note.md'),
        '---\ntitle: test\n---\n\n<div data-x="raw">broken *markdown\n::: unsupported-extension\n',
      );
      // Loading is a read-only operation: the exact source bytes stay put.
      assert.deepEqual(fs.readFileSync(source), original);

      await saveFileContent('note.md', readEditableText('note.md')!);
      assert.deepEqual(fs.readFileSync(source), original);

      await saveFileContent(
        'note.md',
        '---\ntitle: test\n---\n\n<div data-x="raw">broken *markdown\n::: unsupported-extension\nupdated\n',
      );
    });
    assert.deepEqual(
      fs.readFileSync(source),
      Buffer.from('\uFEFF---\r\ntitle: test\r\n---\r\n\r\n<div data-x="raw">broken *markdown\r\n::: unsupported-extension\r\nupdated\r\n', 'utf8'),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('editable markdown keeps uniform LF and normalizes mixed endings only on save', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-line-endings-'));
  try {
    fs.writeFileSync(path.join(root, 'lf.md'), 'one\ntwo\n');
    fs.writeFileSync(path.join(root, 'mixed.md'), 'one\r\ntwo\nthree\n');
    await runWithFolderRoot(root, async () => {
      await saveFileContent('lf.md', 'one\ntwo\nthree\n');
      const mixedBeforeEdit = fs.readFileSync(path.join(root, 'mixed.md'));
      await saveFileContent('mixed.md', readEditableText('mixed.md')!);
      assert.deepEqual(fs.readFileSync(path.join(root, 'mixed.md')), mixedBeforeEdit);
      await saveFileContent('mixed.md', 'one\ntwo\nthree\nfour\n');
    });
    assert.equal(fs.readFileSync(path.join(root, 'lf.md'), 'utf8'), 'one\ntwo\nthree\n');
    // LF is dominant in the source, and is chosen only for the edited save.
    assert.equal(fs.readFileSync(path.join(root, 'mixed.md'), 'utf8'), 'one\ntwo\nthree\nfour\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('editable file writes apply portable path, hidden-derived, and format policy', () => {
  assert.doesNotThrow(() => validateEditableFileWrite("John's Notes.md"));
  assert.throws(() => validateEditableFileWrite('../escape.md'), /invalid segment/);
  assert.throws(() => validateEditableFileWrite('.report.pdf.md'), /app-maintained derived notes/);
  assert.throws(() => validateEditableFileWrite('report.pdf'), /unsupported editable format/);
});

test('createFolder applies writable protected-segment policy', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-create-folder-'));
  try {
    await runWithFolderRoot(root, () => {
      assert.equal(createFolder('Projects'), true);
      assert.equal(fs.statSync(path.join(root, 'Projects')).isDirectory(), true);
      assert.throws(() => createFolder('.stashbase/state'), /cannot write into \.stashbase/);
      assert.throws(() => createFolder('node_modules/pkg'), /excluded directory "node_modules"/);
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('sanitizeFilename keeps folder creation names portable', () => {
  assert.equal(sanitizeFilename('Research:2026/Question?A'), 'Research-2026/Question-A');
});

test('folder listing hides note bundles and legacy derived artifacts', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-listing-hidden-'));
  try {
    fs.writeFileSync(path.join(root, 'note.md'), '# Note\n\nVisible');
    fs.mkdirSync(path.join(root, 'note_files'));
    fs.writeFileSync(path.join(root, 'note_files', 'image.png'), 'asset');
    fs.writeFileSync(path.join(root, 'paper.pdf'), 'pdf bytes');
    fs.writeFileSync(path.join(root, '.paper.md'), 'legacy stem text');
    fs.writeFileSync(path.join(root, '.paper.pdf.md'), 'legacy basename text');
    fs.mkdirSync(path.join(root, '.stashbase'));

    await runWithFolderRoot(root, () => {
      assert.deepEqual(listFiles().map((entry) => entry.name), ['note.md', 'paper.pdf']);
      assert.deepEqual(listFolders().map((entry) => entry.path), []);
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('folder rename scan includes legacy derived notes for stale index cleanup', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-derived-scan-'));
  try {
    fs.mkdirSync(path.join(root, 'Research'));
    fs.writeFileSync(path.join(root, 'Research', 'paper.pdf'), 'pdf bytes');
    fs.writeFileSync(path.join(root, 'Research', '.paper.md'), 'legacy stem text');
    fs.writeFileSync(path.join(root, 'Research', '.paper.pdf.md'), 'legacy basename text');

    await runWithFolderRoot(root, () => {
      assert.deepEqual(
        listIndexableTextFilesUnder('Research').map((entry) => entry.name),
        ['Research/.paper.md', 'Research/.paper.pdf.md'],
      );
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
