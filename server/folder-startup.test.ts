import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before, beforeEach, mock } from 'node:test';

let fixture: string;
let home: string;
let folder: typeof import('./folder.ts');
let config: typeof import('./app-config.ts');
const envNames = ['STASHBASE_FOLDER_HOME', 'STASHBASE_RESOURCES_PATH'] as const;
const originalEnv = new Map(envNames.map((name) => [name, process.env[name]]));
const introduction = () => path.join(home, '👋 Start Here');

before(async () => {
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-folder-startup-'));
  process.env.STASHBASE_RESOURCES_PATH = path.join(fixture, 'resources');
  const source = path.join(process.env.STASHBASE_RESOURCES_PATH, 'assets', 'builtin-project');
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, '01.md'), 'First guide');
  fs.writeFileSync(path.join(source, '02.md'), 'Second guide');
  const homedir = mock.method(os, 'homedir', () => fixture);
  try {
    folder = await import('./folder.ts');
    config = await import('./app-config.ts');
  } finally {
    homedir.mock.restore();
  }
});

beforeEach(() => {
  home = fs.mkdtempSync(path.join(fixture, 'home-'));
  process.env.STASHBASE_FOLDER_HOME = home;
  config.writeAppConfigStrict({});
});

after(() => {
  for (const [name, value] of originalEnv) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  fs.rmSync(fixture, { recursive: true, force: true });
});

test('startup and registration retain unavailable members and favorites', async (t) => {
  const unavailable = path.join(home, 'external');
  const opened = path.join(home, 'opened');
  fs.mkdirSync(unavailable);
  fs.mkdirSync(opened);
  const member = { path: unavailable, openedAt: '2026-01-01T00:00:00Z', favorite: true };
  config.writeAppConfigStrict({ builtinSeeded: true, recentFolders: [member] });
  const stat = fs.promises.stat;
  const inaccessible = t.mock.method(fs.promises, 'stat', async (...args: Parameters<typeof stat>) => {
    if (args[0] === unavailable) throw Object.assign(new Error('unavailable'), { code: 'EACCES' });
    return stat(...args);
  });
  folder.ensureFolderHome();
  assert.deepEqual(config.readAppConfigStrict().recentFolders, [member]);
  assert.deepEqual(await folder.getRecentFoldersAsync(), []);
  await folder.registerProjectFolderAsync(opened);
  assert.deepEqual(config.readAppConfigStrict().recentFolders?.find((r) => r.path === unavailable), member);
  inaccessible.mock.restore();

  // Both an inaccessible directory and an unmounted/deleted path retain membership.
  fs.rmdirSync(unavailable);
  await folder.registerProjectFolderAsync(opened);
  assert.deepEqual(config.readAppConfigStrict().recentFolders?.find((r) => r.path === unavailable), member);
  fs.mkdirSync(unavailable);
  assert.deepEqual((await folder.getRecentFoldersAsync()).find((r) => r.path === unavailable), member);
});

for (const entry of ['existing.md', '.hidden', 'node_modules', '👋 Start Here']) {
  test(`onboarding preserves a home containing ${entry}`, () => {
    const file = path.join(home, entry);
    if (entry === '.hidden' || entry === 'node_modules') fs.mkdirSync(file);
    else fs.writeFileSync(file, 'User content');
    folder.ensureFolderHome();
    assert.deepEqual(fs.readdirSync(home), [entry]);
    assert.equal(config.readAppConfigStrict().builtinSeeded, true);
    assert.deepEqual(config.readAppConfigStrict().recentFolders ?? [], []);
    if (entry === '👋 Start Here') assert.equal(fs.readFileSync(file, 'utf8'), 'User content');
  });
}

test('an unreadable home is not treated as empty and remains retryable', (t) => {
  const readdir = fs.readdirSync;
  const unreadable = t.mock.method(fs, 'readdirSync', (...args: Parameters<typeof readdir>) => {
    if (args[0] === home) throw Object.assign(new Error('unreadable'), { code: 'EACCES' });
    return readdir(...args);
  });
  folder.ensureFolderHome();
  assert.equal(config.readAppConfigStrict().builtinSeeded, undefined);
  assert.equal(fs.existsSync(introduction()), false);
  unreadable.mock.restore();
  folder.ensureFolderHome();
  assert.equal(config.readAppConfigStrict().builtinSeeded, true);
});

test('a partial copy is discarded and the next startup publishes every guide', (t) => {
  const copy = fs.copyFileSync;
  let copies = 0;
  const failCopy = t.mock.method(fs, 'copyFileSync', (...args: Parameters<typeof copy>) => {
    if (++copies === 2) throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
    return copy(...args);
  });
  folder.ensureFolderHome();
  assert.equal(copies, 2);
  assert.deepEqual(fs.readdirSync(home), []);
  assert.equal(config.readAppConfigStrict().builtinSeeded, undefined);
  assert.deepEqual(config.readAppConfigStrict().recentFolders ?? [], []);
  assert.equal(fs.readdirSync(fixture).some((name) => name.startsWith(`${path.basename(home)}.seed-`)), false);
  failCopy.mock.restore();

  folder.ensureFolderHome();
  assert.equal(fs.readFileSync(path.join(introduction(), '01.md'), 'utf8'), 'First guide');
  assert.equal(fs.readFileSync(path.join(introduction(), '02.md'), 'utf8'), 'Second guide');
  assert.equal(config.readAppConfigStrict().builtinSeeded, true);
  assert.equal(config.readAppConfigStrict().recentFolders?.length, 1);
  assert.equal(folder.getCurrentFolder(), null);

  fs.writeFileSync(path.join(introduction(), '01.md'), 'Edited guide');
  config.writeAppConfigStrict({});
  folder.ensureFolderHome();
  assert.equal(fs.readFileSync(path.join(introduction(), '01.md'), 'utf8'), 'Edited guide');
  assert.equal(config.readAppConfigStrict().recentFolders?.length, 1);
  fs.rmSync(introduction(), { recursive: true });
  folder.ensureFolderHome();
  assert.equal(fs.existsSync(introduction()), false);
});

test('content added during copying prevents publication without overwriting the user folder', (t) => {
  const copy = fs.copyFileSync;
  t.mock.method(fs, 'copyFileSync', (...args: Parameters<typeof copy>) => {
    fs.mkdirSync(introduction(), { recursive: true });
    fs.writeFileSync(path.join(introduction(), 'mine.md'), 'Mine');
    return copy(...args);
  });
  folder.ensureFolderHome();
  assert.deepEqual(fs.readdirSync(introduction()), ['mine.md']);
  assert.deepEqual(config.readAppConfigStrict().recentFolders ?? [], []);
});
