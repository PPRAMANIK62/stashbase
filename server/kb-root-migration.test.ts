import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-${label}-`));
}

const home = tmpDir('kb-root-home');
process.env.HOME = home;
process.env.STASHBASE_LOCAL_DATA_ROOT = path.join(home, 'app-data');

const space = await import('./space.ts');

function writeFile(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

test('KB root migration rejects nested roots', async () => {
  const oldRoot = path.join(home, 'LibraryA');
  fs.mkdirSync(path.join(oldRoot, 'Alpha'), { recursive: true });
  await space.setKbRoot(oldRoot, { allowNonEmpty: true });

  await assert.rejects(
    () => space.setKbRoot(path.join(oldRoot, 'Nested')),
    /new root cannot be inside the current root/,
  );
});

test('KB root overwrite migration keeps target intact when copy fails', { skip: process.platform === 'win32' }, async () => {
  const oldRoot = path.join(home, 'LibraryB');
  const newRoot = path.join(home, 'LibraryC');
  fs.mkdirSync(path.join(oldRoot, 'Alpha'), { recursive: true });
  fs.mkdirSync(path.join(newRoot, 'Alpha'), { recursive: true });
  writeFile(path.join(oldRoot, 'Alpha', 'note.md'), '# source\n');
  writeFile(path.join(newRoot, 'Alpha', 'note.md'), '# target\n');
  fs.symlinkSync(path.join(oldRoot, 'Alpha'), path.join(oldRoot, 'Alpha', 'loop'), 'dir');

  await space.setKbRoot(oldRoot, { allowNonEmpty: true });
  await assert.rejects(
    () => space.setKbRoot(newRoot, { migrate: [{ name: 'Alpha', action: 'overwrite' }] }),
    /cyclic symlink detected/,
  );

  assert.equal(fs.readFileSync(path.join(newRoot, 'Alpha', 'note.md'), 'utf8'), '# target\n');
  assert.equal(fs.existsSync(path.join(oldRoot, 'Alpha', 'note.md')), true);
});

test('KB root migration rejects same-root and duplicate payloads', async () => {
  const oldRoot = path.join(home, 'LibrarySameRoot');
  const newRoot = path.join(home, 'LibraryDuplicateTarget');
  fs.mkdirSync(path.join(oldRoot, 'Alpha'), { recursive: true });
  writeFile(path.join(oldRoot, 'Alpha', 'note.md'), '# source\n');

  await space.setKbRoot(oldRoot, { allowNonEmpty: true });
  await assert.rejects(
    () => space.setKbRoot(oldRoot, { migrate: [{ name: 'Alpha', action: 'overwrite' }] }),
    /cannot migrate into the same root/,
  );
  assert.equal(fs.existsSync(path.join(oldRoot, 'Alpha', 'note.md')), true);

  await assert.rejects(
    () => space.setKbRoot(newRoot, {
      migrate: [
        { name: 'Alpha', action: 'move' },
        { name: ' Alpha ', action: 'rename' },
      ],
    }),
    /duplicate migrate entry/,
  );
  assert.equal(fs.existsSync(path.join(oldRoot, 'Alpha', 'note.md')), true);
  assert.equal(fs.existsSync(path.join(newRoot, 'Alpha')), false);
});

test('KB root migration carries local space config into app data', async () => {
  const oldRoot = path.join(home, 'LibraryD');
  const newRoot = path.join(home, 'LibraryE');
  fs.mkdirSync(path.join(oldRoot, 'Alpha', '.stashbase'), { recursive: true });
  writeFile(path.join(oldRoot, 'Alpha', 'note.md'), '# hello\n');
  writeFile(
    path.join(oldRoot, 'Alpha', '.stashbase', 'config.json'),
    JSON.stringify({ mcpServers: { local: { command: '/bin/echo', args: ['ok'] } } }, null, 2),
  );

  await space.setKbRoot(oldRoot, { allowNonEmpty: true });
  await space.setKbRoot(newRoot, { migrate: [{ name: 'Alpha', action: 'move' }] });

  assert.equal(fs.existsSync(path.join(newRoot, 'Alpha', '.stashbase', 'config.json')), false);
  assert.deepEqual(space.readSpaceConfig('Alpha'), {
    mcpServers: { local: { command: '/bin/echo', args: ['ok'] } },
  });
});
