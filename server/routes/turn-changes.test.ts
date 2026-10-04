import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { Server as HttpServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import type { TurnChangeWire } from '../../shared/protocols/http/turn-changes.ts';

const isolatedEnvNames = [
  'HOME',
  'USERPROFILE',
  'LOCALAPPDATA',
  'XDG_DATA_HOME',
  'STASHBASE_LOCAL_DATA_ROOT',
] as const;

test('a recorded turn answers its own project with the text from before it, as often as asked', async (t) => {
  const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-turn-change-route-'));
  const originalEnv = new Map(isolatedEnvNames.map((name) => [name, process.env[name]]));
  let clearCurrentFolder: (() => void) | undefined;
  let closeStateDb: (() => void) | undefined;
  let closeIndexer: (() => Promise<void>) | undefined;
  let server: HttpServer | undefined;

  t.after(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
    }
    clearCurrentFolder?.();
    await closeIndexer?.();
    closeStateDb?.();
    for (const [name, value] of originalEnv) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fs.rmSync(testHome, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  process.env.HOME = testHome;
  process.env.USERPROFILE = testHome;
  process.env.LOCALAPPDATA = path.join(testHome, 'LocalAppData');
  process.env.XDG_DATA_HOME = path.join(testHome, 'xdg-data');
  process.env.STASHBASE_LOCAL_DATA_ROOT = path.join(testHome, 'stashbase-data');

  const [{ default: express }, folder, routes, turnChanges, transaction, stateDb, state] = await Promise.all([
    import('express'),
    import('../folder.ts'),
    import('./turn-changes.ts'),
    import('../turn-changes.ts'),
    import('../text-file-transaction.ts'),
    import('../state-db.ts'),
    import('../state.ts'),
  ]);
  clearCurrentFolder = folder.clearCurrentFolder;
  closeStateDb = stateDb.closeStateDb;
  closeIndexer = () => state.indexer.close();

  const root = path.join(testHome, 'Library Folder').replace(/\\/g, '/');
  const other = path.join(testHome, 'Other Folder').replace(/\\/g, '/');
  for (const directory of [root, other]) {
    fs.mkdirSync(directory, { recursive: true });
    await folder.openProjectFolder(directory);
  }
  folder.clearCurrentFolder();

  const draft = `${root}/Draft.md`;
  const elsewhere = `${other}/Elsewhere.md`;
  fs.writeFileSync(draft, '# Draft\n\nBefore.\n');
  fs.writeFileSync(elsewhere, 'other\n');
  const baseline = await turnChanges.beginTurnBaseline(root);
  fs.writeFileSync(draft, '# Draft\n\nAfter.\n');
  const turn = await turnChanges.finishTurn(baseline);
  assert.ok(turn);

  const app = express();
  routes.mount(app);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server?.once('listening', resolve);
    server?.once('error', reject);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const read = async (query: Record<string, string>): Promise<{ status: number; body: TurnChangeWire & { code?: string } }> => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/turn-changes?${new URLSearchParams(query)}`);
    return { status: response.status, body: (await response.json()) as TurnChangeWire & { code?: string } };
  };

  assert.equal((await read({ folder: root, turn: turn.turnId })).status, 400);

  const outside = await read({ folder: root, turn: turn.turnId, path: elsewhere });
  assert.equal(outside.status, 403);
  assert.equal(outside.body.code, 'PROJECT_SCOPE_MISMATCH');

  const unknown = await read({ folder: root, turn: 'no-such-turn', path: draft });
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.code, 'TURN_CHANGE_EXPIRED');
  assert.equal((await read({ folder: other, turn: turn.turnId, path: elsewhere })).status, 404, 'another project cannot read this turn');

  const first = await read({ folder: root, turn: turn.turnId, path: draft });
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, {
    folder: root,
    turnId: turn.turnId,
    path: draft,
    change: 'edited',
    before: '# Draft\n\nBefore.\n',
    afterVersion: transaction.textVersion(fs.readFileSync(draft)),
  });
  assert.deepEqual((await read({ folder: root, turn: turn.turnId, path: draft })).body, first.body, 'reviewing does not consume the turn');
});
