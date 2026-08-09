import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { clearCurrentFolder, setCurrentFolder } from '../folder.ts';
import { listFilesAndFolders } from '../file-listing.ts';

test('file-listing scan and classification', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-listing-test-'));

  try {
    // Set up test folder structure
    // 1. Root supported file
    fs.writeFileSync(path.join(tempDir, 'note1.md'), 'Heading 1\nSome content');

    // 2. Folder containing supported files (should keep folder + files)
    const folderSupported = path.join(tempDir, 'docs');
    fs.mkdirSync(folderSupported);
    fs.writeFileSync(path.join(folderSupported, 'note2.html'), '<h1>HTML Note</h1>');

    // 3. Folder containing ONLY unsupported files (should prune folder)
    const folderCodeOnly = path.join(tempDir, 'src');
    fs.mkdirSync(folderCodeOnly);
    fs.writeFileSync(path.join(folderCodeOnly, 'main.ts'), 'console.log("hello")');
    fs.writeFileSync(path.join(folderCodeOnly, 'utils.py'), 'def add(a, b): return a + b');

    // 4. Folder containing mixed files (should keep folder, return supported, count unsupported)
    const folderMixed = path.join(tempDir, 'mixed');
    fs.mkdirSync(folderMixed);
    fs.writeFileSync(path.join(folderMixed, 'note3.md'), '# Markdown');
    fs.writeFileSync(path.join(folderMixed, 'data.csv'), '1,2,3');
    fs.writeFileSync(path.join(folderMixed, 'archive.zip'), '');
    fs.writeFileSync(path.join(folderMixed, 'config.json'), '{}');

    // 5. Excluded directory (should not traverse, count, or return)
    const folderExcluded = path.join(tempDir, 'node_modules');
    fs.mkdirSync(folderExcluded);
    fs.writeFileSync(path.join(folderExcluded, 'index.js'), 'module.exports = {}');

    // 6. Physically empty folder (should keep folder)
    const folderEmpty = path.join(tempDir, 'empty-dir');
    fs.mkdirSync(folderEmpty);

    // Run listing scan
    setCurrentFolder(tempDir);
    const result = listFilesAndFolders();

    // Verify folders list (pruning validation)
    // - Should keep 'docs', 'mixed', and 'empty-dir'
    // - Should prune 'src' (code only) and 'node_modules' (excluded)
    const folderPaths = result.folders.map((f) => f.path);
    assert.ok(folderPaths.includes('docs'));
    assert.ok(folderPaths.includes('mixed'));
    assert.ok(folderPaths.includes('empty-dir'));
    assert.ok(!folderPaths.includes('src'), 'src directory (code only) should be pruned');
    assert.ok(!folderPaths.includes('node_modules'), 'node_modules directory should be excluded');

    // Verify files list
    const fileNames = result.files.map((f) => f.name);
    assert.ok(fileNames.includes('note1.md'));
    assert.ok(fileNames.includes('docs/note2.html'));
    assert.ok(fileNames.includes('mixed/note3.md'));
    assert.ok(!fileNames.includes('src/main.ts'), 'unsupported files should not be in the files list');

    // Verify unsupported files counts
    // 'src/main.ts' (.ts) -> source
    // 'src/utils.py' (.py) -> source
    // Total sourceCode = 2
    assert.equal(result.unsupportedFiles.sourceCode, 2);

    // 'mixed/data.csv' (.csv) -> other
    // 'mixed/archive.zip' (.zip) -> other
    // 'mixed/config.json' (.json) -> other
    // Total other = 3
    assert.equal(result.unsupportedFiles.other, 3);

    // Verify otherExtensions mapping and sorting
    // Extensions: .csv (1), .zip (1), .json (1)
    // Since counts are equal, they should be sorted alphabetically: .csv, .json, .zip
    const exts = result.unsupportedFiles.otherExtensions;
    assert.equal(exts.length, 3);
    assert.deepEqual(exts[0], { extension: '.csv', count: 1 });
    assert.deepEqual(exts[1], { extension: '.json', count: 1 });
    assert.deepEqual(exts[2], { extension: '.zip', count: 1 });

  } finally {
    clearCurrentFolder();
    // Recursively clean up the temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
