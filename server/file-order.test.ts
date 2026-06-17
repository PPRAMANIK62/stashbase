import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-${label}-`));
}

const home = tmpDir('file-order-home');
process.env.HOME = home;
process.env.STASHBASE_LOCAL_DATA_ROOT = path.join(home, 'app-data');

const space = await import('./space.ts');
const order = await import('./file-order.ts');

async function openTestSpace(label: string): Promise<void> {
  const kbRoot = tmpDir(`${label}-kb`);
  const spaceRoot = path.join(kbRoot, 'Project');
  fs.mkdirSync(spaceRoot, { recursive: true });
  await space.setKbRoot(kbRoot, { allowNonEmpty: true });
  space.setCurrentSpace(spaceRoot);
}

test('file order follows file renames and cross-folder moves', async () => {
  await openTestSpace('file-order-file-remap');
  order.setFolderOrder('docs', ['one.md', 'two.md']);
  order.setFolderOrder('archive', ['old.md']);

  order.remapFileOrderPath('docs/one.md', 'docs/renamed.md', 'file');

  assert.deepEqual(order.readFileOrder(), {
    docs: ['renamed.md', 'two.md'],
    archive: ['old.md'],
  });

  order.remapFileOrderPath('docs/two.md', 'archive/two.md', 'file');

  assert.deepEqual(order.readFileOrder(), {
    docs: ['renamed.md'],
    archive: ['old.md', 'two.md'],
  });
});

test('file order follows folder renames including nested parent keys', async () => {
  await openTestSpace('file-order-folder-remap');
  order.setFolderOrder('', ['docs', 'root.md']);
  order.setFolderOrder('docs', ['sub', 'one.md']);
  order.setFolderOrder('docs/sub', ['two.md']);

  order.remapFileOrderPath('docs', 'notes', 'folder');

  assert.deepEqual(order.readFileOrder(), {
    '': ['notes', 'root.md'],
    notes: ['sub', 'one.md'],
    'notes/sub': ['two.md'],
  });
});

test('file order cleanup removes deleted files and folder subtrees', async () => {
  await openTestSpace('file-order-remove');
  order.setFolderOrder('', ['docs', 'loose.md']);
  order.setFolderOrder('docs', ['sub', 'one.md']);
  order.setFolderOrder('docs/sub', ['two.md']);

  order.removeFileOrderPath('docs/one.md', 'file');

  assert.deepEqual(order.readFileOrder(), {
    '': ['docs', 'loose.md'],
    docs: ['sub'],
    'docs/sub': ['two.md'],
  });

  order.removeFileOrderPath('docs', 'folder');

  assert.deepEqual(order.readFileOrder(), {
    '': ['loose.md'],
  });
});

test('file order rejects invalid parent paths and child names', async () => {
  await openTestSpace('file-order-invalid');

  assert.throws(
    () => order.setFolderOrder('../escape', ['note.md']),
    /invalid child name|empty path/,
  );
  assert.throws(
    () => order.setFolderOrder('/absolute', ['note.md']),
    /space-relative POSIX path/,
  );
  assert.throws(
    () => order.setFolderOrder('', ['nested/note.md']),
    /invalid child name/,
  );
});
