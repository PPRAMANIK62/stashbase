import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import type { Server as HttpServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import { filesystemPath } from '../filesystem-path.ts';

const isolatedEnvNames = [
  'HOME',
  'USERPROFILE',
  'LOCALAPPDATA',
  'XDG_DATA_HOME',
  'STASHBASE_LOCAL_DATA_ROOT',
] as const;

test('a deliberately removed built-in folder stays out of library membership after restart', (t) => {
  const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-library-seed-'));
  t.after(() => fs.rmSync(testHome, { force: true, recursive: true, maxRetries: 10, retryDelay: 100 }));

  const folderHome = path.join(testHome, 'Documents', 'StashBase');
  fs.mkdirSync(path.join(folderHome, '👋 Start Here'), { recursive: true });
  const configDirectory = path.join(testHome, '.stashbase');
  const configFile = path.join(configDirectory, 'config.json');
  fs.mkdirSync(configDirectory, { recursive: true });
  fs.writeFileSync(
    configFile,
    `${JSON.stringify({ builtinSeeded: true, recentFolders: [] }, null, 2)}\n`,
  );

  const folderModule = pathToFileURL(path.resolve('server', 'folder.ts')).href;
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--input-type=module',
      '--eval',
      `const folder = await import(${JSON.stringify(folderModule)}); folder.seedBuiltinFolder();`,
    ],
    {
      cwd: path.resolve('.'),
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: testHome,
        USERPROFILE: testHome,
        STASHBASE_APP_ROOT: path.resolve('.'),
      },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8')) as {
    recentFolders?: unknown[];
  };
  assert.deepEqual(config.recentFolders, []);
});

test('library routes return authoritative membership and open the selected folder', async (t) => {
  const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-library-route-'));
  const originalEnv = new Map(isolatedEnvNames.map((name) => [name, process.env[name]]));
  let closeIndexer: (() => Promise<void>) | undefined;
  let clearWindowFolder: (() => void) | undefined;
  let server: HttpServer | undefined;

  t.after(async () => {
    clearWindowFolder?.();
    await closeIndexer?.();
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server?.close(() => resolve()));
    }
    for (const [name, value] of originalEnv) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fs.rmSync(testHome, { force: true, recursive: true, maxRetries: 10, retryDelay: 100 });
  });

  process.env.HOME = testHome;
  process.env.USERPROFILE = testHome;
  process.env.LOCALAPPDATA = path.join(testHome, 'LocalAppData');
  process.env.XDG_DATA_HOME = path.join(testHome, 'xdg-data');
  process.env.STASHBASE_LOCAL_DATA_ROOT = path.join(testHome, 'stashbase-data');

  const [{ default: express }, folder, { withWindowContext }, libraryRoutes, state] =
    await Promise.all([
      import('express'),
      import('../folder.ts'),
      import('../http.ts'),
      import('./library.ts'),
      import('../state.ts'),
    ]);
  closeIndexer = () => state.indexer.close();
  clearWindowFolder = () =>
    folder.runWithWindowId('library-window', () => folder.clearCurrentFolder());

  const selectedFolder = path.join(testHome, 'Research');
  fs.mkdirSync(selectedFolder);
  // The library API answers in source spelling with POSIX separators, which is
  // not what path.join produces on Windows. Filesystem calls keep the native
  // spelling above.
  const selectedFolderPath = filesystemPath.absolute(selectedFolder);
  const app = express();
  app.use(express.json());
  app.use(withWindowContext);
  libraryRoutes.mount(app);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server?.once('listening', resolve);
    server?.once('error', reject);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const headers = {
    'content-type': 'application/json',
    'x-stashbase-window-id': 'library-window',
  };

  const initial = await fetch(`${baseUrl}/api/library`, { headers });
  assert.equal(initial.status, 200);
  assert.deepEqual(await initial.json(), {
    current: null,
    homeDir: testHome,
    recent: [],
  });

  const malformed = await fetch(`${baseUrl}/api/library/folders/open`, {
    body: JSON.stringify({ create: true, path: selectedFolder }),
    headers,
    method: 'POST',
  });
  assert.equal(malformed.status, 400);

  const opened = await fetch(`${baseUrl}/api/library/folders/open`, {
    body: JSON.stringify({ path: selectedFolder }),
    headers,
    method: 'POST',
  });
  assert.equal(opened.status, 200);
  const payload = (await opened.json()) as {
    current: { name: string; path: string } | null;
    recent: Array<{ path: string }>;
  };
  assert.deepEqual(payload.current, { name: 'Research', path: selectedFolderPath });
  assert.equal(payload.recent[0]?.path, selectedFolderPath);

  const current = await fetch(`${baseUrl}/api/library`, { headers });
  assert.equal(current.status, 200);
  const currentPayload = (await current.json()) as {
    current: { name: string; path: string } | null;
  };
  assert.deepEqual(currentPayload.current, {
    name: 'Research',
    path: selectedFolderPath,
  });

  const removed = await fetch(`${baseUrl}/api/library/folders/remove`, {
    body: JSON.stringify({ path: selectedFolder }),
    headers,
    method: 'POST',
  });
  assert.equal(removed.status, 200);
  assert.deepEqual(await removed.json(), {
    current: null,
    homeDir: testHome,
    recent: [],
  });
  assert.equal(fs.statSync(selectedFolder).isDirectory(), true);

  const missingFolder = path.join(testHome, 'Moved away');
  fs.mkdirSync(missingFolder);
  const openedMissing = await fetch(`${baseUrl}/api/library/folders/open`, {
    body: JSON.stringify({ path: missingFolder }),
    headers,
    method: 'POST',
  });
  assert.equal(openedMissing.status, 200);
  fs.rmSync(missingFolder, { recursive: true, maxRetries: 10, retryDelay: 100 });

  const lost = await fetch(`${baseUrl}/api/library`, { headers });
  assert.equal(lost.status, 200);
  assert.deepEqual(await lost.json(), {
    current: null,
    homeDir: testHome,
    recent: [],
  });

  const forgotMissing = await fetch(`${baseUrl}/api/library/folders/remove`, {
    body: JSON.stringify({ path: missingFolder }),
    headers,
    method: 'POST',
  });
  assert.equal(forgotMissing.status, 200);
});
