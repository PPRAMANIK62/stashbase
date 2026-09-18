import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { Server as HttpServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import type { DocumentRevisionsWire } from '../../shared/protocols/http/document-revisions.ts';

/** The 200 body, which is the only one with fields to read. A refused drain
 *  answers no JSON and its assertions read the status alone. */
type DrainBody = DocumentRevisionsWire;

const isolatedEnvNames = [
  'HOME',
  'USERPROFILE',
  'LOCALAPPDATA',
  'XDG_DATA_HOME',
  'STASHBASE_LOCAL_DATA_ROOT',
] as const;

test('the drain hands a folder its own proposals once and converges to empty', async (t) => {
  const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-revision-drain-'));
  const originalEnv = new Map(isolatedEnvNames.map((name) => [name, process.env[name]]));
  let clearCurrentFolder: (() => void) | undefined;
  let closeStateDb: (() => void) | undefined;
  let closeIndexer: (() => Promise<void>) | undefined;
  let clearWindows: (() => void) | undefined;
  let server: HttpServer | undefined;

  t.after(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
    }
    clearCurrentFolder?.();
    clearWindows?.();
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

  const [{ default: express }, folder, routes, revisions, stateDb, state, http] = await Promise.all([
    import('express'),
    import('../folder.ts'),
    import('./document-revisions.ts'),
    import('../document-revisions.ts'),
    import('../state-db.ts'),
    import('../state.ts'),
    import('../http.ts'),
  ]);
  clearCurrentFolder = folder.clearCurrentFolder;
  closeStateDb = stateDb.closeStateDb;
  closeIndexer = () => state.indexer.close();

  const root = path.join(testHome, 'Library Folder');
  const other = path.join(testHome, 'Other Folder');
  const nested = path.join(root, 'Nested Folder');
  for (const [directory, windowId] of [[root, 'root-window'], [other, 'other-window'], [nested, 'nested-window']] as const) {
    fs.mkdirSync(directory, { recursive: true });
    await folder.runWithWindowId(windowId, () => folder.openProjectFolder(directory));
  }
  clearWindows = () => {
    for (const windowId of ['root-window', 'other-window', 'nested-window']) {
      folder.runWithWindowId(windowId, () => folder.clearCurrentFolder());
    }
  };

  const app = express();
  app.use(express.json());
  app.use(http.withWindowContext);
  routes.mount(app);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server?.once('listening', resolve);
    server?.once('error', reject);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;

  const drain = async (query: string, windowId = 'root-window'): Promise<{ status: number; body: DrainBody }> => {
    const response = await fetch(`${base}/api/document-revisions${query}`, { headers: { 'x-stashbase-window-id': windowId } });
    return { status: response.status, body: (await response.json().catch(() => null)) as DrainBody };
  };
  const forFolder = (directory: string) => `?folder=${encodeURIComponent(directory)}`;
  const park = async (directory: string, name: string): Promise<string> => {
    const file = path.join(directory, name);
    fs.writeFileSync(file, '# Note\n\nOriginal.\n', 'utf8');
    const result = await revisions.suggestProjectFileEdits(file, `# Note\n\nProposed for ${name}.\n`, { withinFolder: directory });
    assert.equal(result.parked, true);
    return file.replace(/\\/g, '/');
  };

  assert.equal((await drain('')).status, 400, 'a drain with no folder would have to guess whose review to consume');
  assert.equal((await drain('?folder=')).status, 400);
  assert.equal((await drain(forFolder(path.join(testHome, 'Elsewhere')))).status, 404);
  assert.deepEqual((await drain(forFolder(root))).body.proposals, [], 'an empty store reads as nothing, not an error');

  const ownPath = await park(root, 'Own.md');
  const otherPath = await park(other, 'Other.md');
  // A nested registered project resolves a path to itself, but the window that
  // must show the review is the one with the outer folder open.
  const nestedPath = await park(nested, 'Nested.md');

  assert.equal((await drain(forFolder(other))).status, 409, 'another window cannot consume this review');
  assert.equal((await drain(forFolder(root), 'unknown-window')).status, 409);

  const first = await drain(forFolder(root));
  assert.equal(first.status, 200);
  assert.equal(first.body.folder, root.replace(/\\/g, '/'));
  assert.deepEqual(
    first.body.proposals.map((proposal) => proposal.path).sort(),
    [nestedPath, ownPath].sort(),
  );
  assert.equal(first.body.proposals[0].origin, 'agent');
  assert.match(first.body.proposals[0].baseVersion, /^sha256:[0-9a-f]{64}$/);

  // Handing the proposals out removes them, so a second reader cannot open the
  // same review. Re-reading is empty rather than an error.
  const second = await drain(forFolder(root));
  assert.equal(second.status, 200);
  assert.deepEqual(second.body.proposals, []);

  // Another project's review was never in this folder's answer.
  const elsewhere = await drain(forFolder(other), 'other-window');
  assert.deepEqual(elsewhere.body.proposals.map((proposal) => proposal.path), [otherPath]);

  // Removing a project retires its proposals, so re-adding the same path in one
  // session cannot hand the new window a review from before the removal. A
  // retained nested project keeps its own, the way it keeps its preparation.
  const doomed = await park(root, 'Doomed.md');
  const retained = await park(nested, 'Retained.md');
  revisions.forgetFolderProposals(root, [nested]);
  assert.deepEqual(
    revisions.drainPendingProposals(root).map((proposal) => proposal.path),
    [retained],
    `${doomed} left with its project`,
  );
});
