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

test('KB root migration failure after runtime stop restores old runtime and keeps sources', async () => {
  const oldRoot = path.join(home, 'LibraryRestoreOld');
  const newRoot = path.join(home, 'LibraryRestoreNew');
  fs.mkdirSync(path.join(oldRoot, 'Alpha'), { recursive: true });
  writeFile(path.join(oldRoot, 'Alpha', 'note.md'), '# source\n');

  await space.setKbRoot(oldRoot, { allowNonEmpty: true });
  space.runWithWindowId('restore-window', () => space.setCurrentSpace(path.join(oldRoot, 'Alpha')));

  let beforeCalled = 0;
  const restoredRoots: string[] = [];
  const restoredSwitches: Array<{ root: string; windowId: string }> = [];
  space.onBeforeKbRootChange((from, to) => {
    if (from === oldRoot && to === newRoot) beforeCalled += 1;
  });
  space.onKbRootChange((root) => {
    if (root === oldRoot) restoredRoots.push(root);
  });
  space.onSwitch((root, windowId) => {
    if (windowId === 'restore-window') restoredSwitches.push({ root, windowId });
  });

  await assert.rejects(
    () => space.setKbRoot(newRoot, {
      migrate: [
        { name: 'Alpha', action: 'move' },
        { name: ' Alpha ', action: 'rename' },
      ],
    }),
    /duplicate migrate entry/,
  );

  assert.equal(beforeCalled, 1);
  assert.deepEqual(restoredRoots, [oldRoot]);
  assert.deepEqual(restoredSwitches, [{ root: path.join(oldRoot, 'Alpha'), windowId: 'restore-window' }]);
  assert.equal(space.getKbRoot(), oldRoot);
  assert.equal(
    space.runWithWindowId('restore-window', () => space.getCurrentSpace()),
    path.join(oldRoot, 'Alpha'),
  );
  assert.equal(fs.readFileSync(path.join(oldRoot, 'Alpha', 'note.md'), 'utf8'), '# source\n');
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

test('KB root migration prunes copied per-machine stashbase state', async () => {
  const oldRoot = path.join(home, 'LibraryPortableOld');
  const newRoot = path.join(home, 'LibraryPortableNew');
  const stash = path.join(oldRoot, 'Alpha', '.stashbase');
  fs.mkdirSync(path.join(stash, 'store'), { recursive: true });
  fs.mkdirSync(path.join(stash, 'cache'), { recursive: true });
  writeFile(path.join(oldRoot, 'Alpha', 'note.md'), '# hello\n');
  writeFile(path.join(stash, 'snapshot.parquet'), 'snapshot');
  writeFile(path.join(stash, 'snapshot.meta.json'), '{"version":3}\n');
  writeFile(path.join(stash, 'config.json'), '{}');
  writeFile(path.join(stash, 'state.db'), 'db');
  writeFile(path.join(stash, 'state.db-wal'), 'wal');
  writeFile(path.join(stash, 'state.db-shm'), 'shm');
  writeFile(path.join(stash, 'state.db-old'), 'old');
  writeFile(path.join(stash, 'pdf-status.json'), '{}');
  writeFile(path.join(stash, 'pdf-status.json.migrated'), '{}');
  writeFile(path.join(stash, 'store', 'milvus.db'), 'milvus');
  writeFile(path.join(stash, 'cache', 'tmp'), 'cache');

  await space.setKbRoot(oldRoot, { allowNonEmpty: true });
  await space.setKbRoot(newRoot, { migrate: [{ name: 'Alpha', action: 'move' }] });

  const migratedStash = path.join(newRoot, 'Alpha', '.stashbase');
  assert.equal(fs.existsSync(path.join(migratedStash, 'snapshot.parquet')), true);
  assert.equal(fs.existsSync(path.join(migratedStash, 'snapshot.meta.json')), true);
  assert.equal(fs.existsSync(path.join(migratedStash, '.gitignore')), true);
  assert.equal(fs.existsSync(path.join(migratedStash, 'config.json')), false);
  assert.equal(fs.existsSync(path.join(migratedStash, 'state.db')), false);
  assert.equal(fs.existsSync(path.join(migratedStash, 'state.db-wal')), false);
  assert.equal(fs.existsSync(path.join(migratedStash, 'state.db-shm')), false);
  assert.equal(fs.existsSync(path.join(migratedStash, 'state.db-old')), false);
  assert.equal(fs.existsSync(path.join(migratedStash, 'pdf-status.json')), false);
  assert.equal(fs.existsSync(path.join(migratedStash, 'pdf-status.json.migrated')), false);
  assert.equal(fs.existsSync(path.join(migratedStash, 'store')), false);
  assert.equal(fs.existsSync(path.join(migratedStash, 'cache')), false);
});

test('KB root migration removes old app-data space config after source deletion', async () => {
  const oldRoot = path.join(home, 'LibraryConfigOld');
  const newRoot = path.join(home, 'LibraryConfigNew');
  fs.mkdirSync(path.join(oldRoot, 'Alpha'), { recursive: true });
  writeFile(path.join(oldRoot, 'Alpha', 'note.md'), '# hello\n');

  await space.setKbRoot(oldRoot, { allowNonEmpty: true });
  space.writeSpaceConfig('Alpha', {
    mcpServers: { local: { command: '/bin/echo', args: ['ok'] } },
  });
  const oldConfigPath = space.getSpaceConfigPath('Alpha');

  await space.setKbRoot(newRoot, { migrate: [{ name: 'Alpha', action: 'move' }] });

  assert.equal(fs.existsSync(oldConfigPath), false);
  assert.deepEqual(space.readSpaceConfig('Alpha'), {
    mcpServers: { local: { command: '/bin/echo', args: ['ok'] } },
  });
});

test('KB root migration cleans stale migration staging folders only', async () => {
  const oldRoot = path.join(home, 'LibraryStaleStageOld');
  const newRoot = path.join(home, 'LibraryStaleStageNew');
  const stash = path.join(newRoot, '.stashbase');
  const oldStage = path.join(stash, 'migration-stage-old');
  const oldBackup = path.join(stash, 'migration-backup-old');
  const freshStage = path.join(stash, 'migration-stage-fresh');
  const freshBackup = path.join(stash, 'migration-backup-fresh');
  fs.mkdirSync(path.join(oldRoot, 'Alpha'), { recursive: true });
  writeFile(path.join(oldRoot, 'Alpha', 'note.md'), '# hello\n');
  fs.mkdirSync(oldStage, { recursive: true });
  fs.mkdirSync(oldBackup, { recursive: true });
  fs.mkdirSync(freshStage, { recursive: true });
  fs.mkdirSync(freshBackup, { recursive: true });
  const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
  fs.utimesSync(oldStage, old, old);
  fs.utimesSync(oldBackup, old, old);

  await space.setKbRoot(oldRoot, { allowNonEmpty: true });
  await space.setKbRoot(newRoot, { migrate: [{ name: 'Alpha', action: 'move' }] });

  assert.equal(fs.existsSync(oldStage), false);
  assert.equal(fs.existsSync(oldBackup), false);
  assert.equal(fs.existsSync(freshStage), true);
  assert.equal(fs.existsSync(freshBackup), true);
});

test('space config writes sanitized JSON atomically with owner-only mode', async () => {
  const root = path.join(home, 'LibrarySpaceConfig');
  fs.mkdirSync(path.join(root, 'Alpha'), { recursive: true });
  await space.setKbRoot(root, { allowNonEmpty: true });

  space.writeSpaceConfig('Alpha', {
    mcpServers: {
      valid: {
        command: '  /bin/echo  ',
        args: ['ok', 42 as unknown as string],
        env: { TOKEN: 'secret', BAD: 123 as unknown as string },
      },
      invalid: { command: '   ' },
    },
  });

  const file = space.getSpaceConfigPath('Alpha');
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {
    mcpServers: {
      valid: {
        command: '/bin/echo',
        args: ['ok'],
        env: { TOKEN: 'secret' },
      },
    },
  });
  if (process.platform !== 'win32') {
    assert.equal((fs.statSync(file).mode & 0o777), 0o600);
  }
  assert.deepEqual(fs.readdirSync(path.dirname(file)).filter((name) => name.endsWith('.tmp')), []);
});
