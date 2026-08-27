import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { clearCurrentFolder, setCurrentFolder } from '../folder.ts';
import { listFilesAndFolders, listFilesAndFoldersAsync } from '../file-listing.ts';

test('file-listing reports the truthful workbench tree without traversing excluded infrastructure', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-listing-test-'));

  try {
    // Set up test folder structure
    // 1. Root supported file
    fs.writeFileSync(path.join(tempDir, 'note1.md'), 'Heading 1\nSome content');

    // 2. Folder containing supported files (should keep folder + files)
    const folderSupported = path.join(tempDir, 'docs');
    fs.mkdirSync(folderSupported);
    fs.writeFileSync(path.join(folderSupported, 'note2.html'), '<h1>HTML Note</h1>');

    // 3. A code-only folder remains visible with generic files.
    const folderCodeOnly = path.join(tempDir, 'src');
    fs.mkdirSync(folderCodeOnly);
    fs.writeFileSync(path.join(folderCodeOnly, 'main.ts'), 'console.log("hello")');
    fs.writeFileSync(path.join(folderCodeOnly, 'utils.py'), 'def add(a, b): return a + b');

    // 4. Mixed known and generic files.
    const folderMixed = path.join(tempDir, 'mixed');
    fs.mkdirSync(folderMixed);
    fs.writeFileSync(path.join(folderMixed, 'note3.md'), '# Markdown');
    fs.writeFileSync(path.join(folderMixed, 'data.csv'), '1,2,3');
    fs.writeFileSync(path.join(folderMixed, 'archive.zip'), '');
    fs.writeFileSync(path.join(folderMixed, 'config.JSON'), '{ invalid json');
    fs.writeFileSync(path.join(folderMixed, 'readme.txt'), 'searchable plain text');
    fs.writeFileSync(path.join(folderMixed, 'unfinished.tmp'), 'a user-owned temp file');
    fs.mkdirSync(path.join(folderMixed, 'config.json_files'));
    fs.writeFileSync(path.join(folderMixed, 'config.json_files', 'asset.md'), '# visible child');

    // 5. Excluded directory is represented but never traversed.
    const folderExcluded = path.join(tempDir, 'node_modules');
    fs.mkdirSync(folderExcluded);
    fs.writeFileSync(path.join(folderExcluded, 'index.js'), 'module.exports = {}');

    // 6. Physically empty folder (should keep folder)
    const folderEmpty = path.join(tempDir, 'empty-dir');
    fs.mkdirSync(folderEmpty);

    // 7. Junk/derived dot-files remain hidden, ordinary user dot-files do not.
    fs.writeFileSync(path.join(tempDir, '.DS_Store'), '');
    fs.writeFileSync(path.join(tempDir, '.env'), 'TOKEN=local');
    fs.writeFileSync(path.join(tempDir, '.private.md'), '# Hidden dot-note');
    fs.writeFileSync(path.join(tempDir, '.note.pdf.md'), 'derived');
    const folderDotOnly = path.join(tempDir, 'dot-only');
    fs.mkdirSync(folderDotOnly);
    fs.writeFileSync(path.join(folderDotOnly, '.DS_Store'), '');

    // Run listing scan
    setCurrentFolder(tempDir);
    const result = listFilesAndFolders();
    const originalReaddirSync = fs.readdirSync;
    fs.readdirSync = (() => {
      throw new Error('async HTTP listing used synchronous directory I/O');
    }) as typeof fs.readdirSync;
    let asyncResult = result;
    try {
      asyncResult = await listFilesAndFoldersAsync();
    } finally {
      fs.readdirSync = originalReaddirSync;
    }
    assert.deepEqual(asyncResult, result, 'async HTTP listing must preserve sidebar classification');

    // Every ordinary folder survives even when it contains only generic files.
    const folderPaths = result.folders.map((f) => f.path);
    assert.ok(folderPaths.includes('docs'));
    assert.ok(folderPaths.includes('mixed'));
    assert.ok(folderPaths.includes('empty-dir'));
    assert.ok(folderPaths.includes('src'), 'code-only directories stay visible');
    assert.ok(folderPaths.includes('node_modules'), 'excluded directories get an explanatory placeholder');
    assert.equal(result.folders.find((f) => f.path === 'node_modules')?.kind, 'excluded');
    assert.ok(folderPaths.includes('dot-only'), 'a folder holding only dot-files stays visible as empty');

    // Verify files list
    const fileNames = result.files.map((f) => f.name);
    assert.ok(fileNames.includes('note1.md'));
    assert.ok(fileNames.includes('docs/note2.html'));
    assert.ok(fileNames.includes('mixed/note3.md'));
    assert.ok(fileNames.includes('mixed/config.JSON'));
    assert.equal(result.files.find((f) => f.name === 'mixed/readme.txt')?.format, 'text');
    assert.equal(result.files.find((f) => f.name === 'src/main.ts')?.format, 'generic');
    assert.equal(result.files.find((f) => f.name === 'src/utils.py')?.format, 'generic');
    assert.equal(result.files.find((f) => f.name === 'mixed/data.csv')?.format, 'generic');
    assert.equal(result.files.find((f) => f.name === 'mixed/archive.zip')?.format, 'generic');
    assert.equal(result.files.find((f) => f.name === 'mixed/unfinished.tmp')?.format, 'generic');
    assert.ok(fileNames.includes('mixed/config.json_files/asset.md'), 'JSON must not claim a note bundle');
    assert.ok(fileNames.includes('.env'), 'ordinary user dot-files stay visible');
    assert.ok(!fileNames.includes('.DS_Store'), 'junk dot-files stay hidden');
    assert.ok(!fileNames.includes('.private.md'), 'the established hidden dot-note namespace stays hidden');
    assert.ok(!fileNames.includes('.note.pdf.md'), 'hidden derived notes never surface');
    assert.ok(!fileNames.includes('node_modules/index.js'), 'excluded directory contents are never traversed');

  } finally {
    clearCurrentFolder();
    // Recursively clean up the temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
