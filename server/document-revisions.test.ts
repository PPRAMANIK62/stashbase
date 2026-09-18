import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { Server as HttpServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { callTool } from './__tests__/mcp-call.ts';

const isolatedEnvNames = [
  'HOME',
  'USERPROFILE',
  'LOCALAPPDATA',
  'XDG_DATA_HOME',
  'STASHBASE_LOCAL_DATA_ROOT',
] as const;

test('suggest_edits parks a Markdown revision without touching disk and refuses the rest', async (t) => {
  const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-suggest-edits-'));
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

  const [
    { default: express },
    folder,
    projectRoutes,
    folderRoutes,
    mcpRoutes,
    revisions,
    transaction,
    projectMutations,
    stateDb,
    state,
  ] = await Promise.all([
    import('express'),
    import('./folder.ts'),
    import('./routes/project-files.ts'),
    import('./routes/folders.ts'),
    import('./routes/mcp-http.ts'),
    import('./document-revisions.ts'),
    import('./text-file-transaction.ts'),
    import('./project-file-mutations.ts'),
    import('./state-db.ts'),
    import('./state.ts'),
  ]);
  clearCurrentFolder = folder.clearCurrentFolder;
  closeStateDb = stateDb.closeStateDb;
  closeIndexer = () => state.indexer.close();

  const root = path.join(testHome, 'Library Folder');
  fs.mkdirSync(path.join(root, 'Drafts'), { recursive: true });
  await folder.openProjectFolder(root);
  folder.clearCurrentFolder();

  const app = express();
  app.use(express.json());
  projectRoutes.mount(app);
  folderRoutes.mount(app);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server?.once('listening', resolve);
    server?.once('error', reject);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const token = 'a'.repeat(64);
  mcpRoutes.mount(app, { webBase: base, getToken: () => token });

  const source = path.join(root, 'Drafts', 'Note.md');
  const onDisk = '# Note\n\nThe first draft said this.\n';
  fs.writeFileSync(source, onDisk, 'utf8');
  const proposal = '# Note\n\nThe revision says this instead.\n';

  await assert.rejects(
    callTool(base, token, 'suggest_edits', { path: source, content: proposal }),
    /FOLDER_REQUIRED|explicit project/,
  );
  const stale = await fetch(`${base}/api/project/file/suggest-edits`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-stashbase-agent-session-id': 'stale-session' },
    body: JSON.stringify({ path: source, content: proposal, folder: root }),
  });
  assert.equal(stale.status, 409, 'an explicit folder cannot rescue a stale session identity');
  assert.deepEqual(revisions.drainPendingProposals(root), []);

  const parked = await callTool(base, token, 'suggest_edits', { path: source, content: proposal, folder: root });
  assert.equal(parked.parked, true);
  assert.equal(parked.path, source.replace(/\\/g, '/'));
  assert.equal(parked.baseVersion, transaction.textVersion(Buffer.from(onDisk, 'utf8')));
  assert.match(String(parked.id), /^[0-9a-f-]{36}$/);
  assert.equal(parked.changes, undefined, 'the renderer owns the change count, not the host');
  assert.equal(fs.readFileSync(source, 'utf8'), onDisk, 'a proposal never writes to disk');

  // The newest proposal for a path replaces the older unread one.
  const second = '# Note\n\nThe newest revision wins.\n';
  const secondPark = await callTool(base, token, 'suggest_edits', { path: source, content: second, folder: root });
  assert.notEqual(secondPark.id, parked.id);
  const drained = revisions.drainPendingProposals(root);
  assert.equal(drained.length, 1);
  assert.equal(drained[0]?.content, second);
  assert.equal(drained[0]?.id, secondPark.id);
  assert.equal(drained[0]?.origin, 'agent');
  assert.equal(drained[0]?.path, source.replace(/\\/g, '/'));

  const unchanged = await callTool(base, token, 'suggest_edits', { path: source, content: onDisk, folder: root });
  assert.equal(unchanged.parked, false);
  assert.equal(unchanged.reason, 'no-changes');
  assert.deepEqual(revisions.drainPendingProposals(root), [], 'an empty review is never parked');

  const jsonSource = path.join(root, 'Drafts', 'config.json');
  fs.writeFileSync(jsonSource, '{"a": 1}\n', 'utf8');
  await assert.rejects(
    callTool(base, token, 'suggest_edits', { path: jsonSource, content: '{"a": 2}\n', folder: root }),
    /415|UNSUPPORTED_FORMAT/,
  );

  const pdfSource = path.join(root, 'Drafts', 'report.pdf');
  fs.writeFileSync(pdfSource, '%PDF-1.4\n');
  await assert.rejects(
    callTool(base, token, 'suggest_edits', { path: pdfSource, content: '# Revised report\n', folder: root }),
    /415|UNSUPPORTED_FORMAT/,
  );

  const outside = path.join(testHome, 'Elsewhere', 'Note.md');
  fs.mkdirSync(path.dirname(outside), { recursive: true });
  fs.writeFileSync(outside, onDisk, 'utf8');
  await assert.rejects(
    callTool(base, token, 'suggest_edits', { path: outside, content: proposal, folder: root }),
    /must live under one of your folders/,
  );

  const corrupted = `# Note

[
P_0=\frac{EPS}{1+r}
]
`;
  assert.match(corrupted, /\u000c/, 'the fixture really does carry a control byte');
  await assert.rejects(
    callTool(base, token, 'suggest_edits', { path: source, content: corrupted, folder: root }),
    /INVALID_TEXT_CONTENT|String\.raw/,
  );

  const missing = path.join(root, 'Drafts', 'Never written.md');
  await assert.rejects(
    callTool(base, token, 'suggest_edits', { path: missing, content: proposal, folder: root }),
    /404|not found/,
  );

  assert.deepEqual(revisions.drainPendingProposals(root), [], 'no refusal parked anything');
  assert.equal(fs.readFileSync(source, 'utf8'), onDisk);

  // Nothing prompts a human before a park any more, so the caller's own project
  // is the boundary. A session bound elsewhere cannot leave a review here.
  const elsewhere = path.join(testHome, 'Other Library');
  fs.mkdirSync(elsewhere, { recursive: true });
  await folder.openProjectFolder(elsewhere);
  folder.clearCurrentFolder();
  await assert.rejects(
    revisions.suggestProjectFileEdits(source, proposal, { withinFolder: elsewhere }),
    (err: Error & { code?: string; status?: number }) =>
      err.code === 'PROJECT_SCOPE_MISMATCH' && err.status === 403,
  );
  assert.deepEqual(revisions.drainPendingProposals(root), []);

  const oversized = `# Note\n\n${'a'.repeat(1024 * 1024)}\n`;
  await assert.rejects(
    revisions.suggestProjectFileEdits(source, oversized, { withinFolder: root }),
    (err: Error & { code?: string }) => err.code === 'PROPOSAL_TOO_LARGE',
  );
  assert.deepEqual(revisions.drainPendingProposals(root), [], 'an oversized proposal never reaches the store');

  // An agent that stops proposing and starts enumerating is refused while the
  // reader can still drain what is already waiting.
  const bulkPaths: string[] = [];
  for (let index = 0; index < 50; index++) {
    const bulk = path.join(root, 'Bulk', `note-${index}.md`);
    fs.mkdirSync(path.dirname(bulk), { recursive: true });
    fs.writeFileSync(bulk, `# Bulk ${index}\n`, 'utf8');
    await revisions.suggestProjectFileEdits(bulk, `# Bulk ${index}\n\nProposed.\n`, { withinFolder: root });
    bulkPaths.push(bulk.replace(/\\/g, '/'));
  }
  const overflow = path.join(root, 'Bulk', 'note-50.md');
  fs.writeFileSync(overflow, '# Bulk 50\n', 'utf8');
  await assert.rejects(
    revisions.suggestProjectFileEdits(overflow, '# Bulk 50\n\nProposed.\n', { withinFolder: root }),
    (err: Error & { code?: string; status?: number }) =>
      err.code === 'TOO_MANY_PENDING_PROPOSALS' && err.status === 429,
  );
  // Replacing one already parked costs no slot, so a revised proposal still lands.
  const replaced = await revisions.suggestProjectFileEdits(bulkPaths[0], '# Bulk 0\n\nRevised again.\n', { withinFolder: root });
  assert.equal(replaced.parked, true);

  // A folder nobody opens is never drained, so age is what releases it.
  const clock = { value: Date.now() };
  assert.equal(revisions.drainPendingProposals(root, () => clock.value + (6 * 60 * 60 * 1000)).length, 0);
  assert.deepEqual(revisions.drainPendingProposals(root), [], 'the sweep removed them rather than hiding them');

  // Parking takes the same per-source lock the write paths take, so a write
  // landing between the snapshot read and the park cannot leave the proposal
  // holding a baseVersion that was already stale when it was recorded.
  const locked = path.join(root, 'Drafts', 'Locked.md');
  fs.writeFileSync(locked, '# Locked\n\nOriginal.\n', 'utf8');
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const holding = folder.runWithFolderRoot(root, () =>
    transaction.withTextFileTransaction('Drafts/Locked.md', () => held));
  let parkSettled = false;
  const parking = revisions.suggestProjectFileEdits(locked, '# Locked\n\nProposed.\n', { withinFolder: root });
  void parking.then(() => { parkSettled = true; }, () => { parkSettled = true; });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(parkSettled, false, 'parking waits for the source lock');
  release();
  await holding;
  assert.equal((await parking).parked, true);
  assert.equal(revisions.drainPendingProposals(root).length, 1);

  // A renamed document keeps its pending review under the new path.
  const renamable = path.join(root, 'Drafts', 'Renamable.md');
  const renamed = path.join(root, 'Drafts', 'Renamed.md');
  fs.writeFileSync(renamable, '# Renamable\n\nOriginal.\n', 'utf8');
  await revisions.suggestProjectFileEdits(renamable, '# Renamable\n\nProposed.\n', { withinFolder: root });
  await projectMutations.moveProjectFile(renamable, renamed);
  const afterRename = revisions.drainPendingProposals(root);
  assert.deepEqual(afterRename.map((entry) => entry.path), [renamed.replace(/\\/g, '/')]);
  assert.equal(afterRename[0]?.content, '# Renamable\n\nProposed.\n');

  // A deleted document has no review to open.
  const doomed = path.join(root, 'Drafts', 'Doomed.md');
  fs.writeFileSync(doomed, '# Doomed\n\nOriginal.\n', 'utf8');
  await revisions.suggestProjectFileEdits(doomed, '# Doomed\n\nProposed.\n', { withinFolder: root });
  await projectMutations.deleteProjectFile(doomed);
  assert.deepEqual(revisions.drainPendingProposals(root), []);

  // Folder mutations retire paths they can no longer deliver, including a
  // rename whose disk work succeeds before the index reports completion.
  t.mock.method(state.indexer, 'renamePathPrefix', async () => undefined);
  t.mock.method(state.indexer, 'deletePathPrefix', async () => undefined);
  await folder.openProjectFolder(root);
  const oldFolder = path.join(root, 'Review drafts');
  fs.mkdirSync(oldFolder);
  const folderSource = path.join(oldFolder, 'plan.md');
  fs.writeFileSync(folderSource, '# Plan\n', 'utf8');
  await revisions.suggestProjectFileEdits(folderSource, '# Revised plan\n', { withinFolder: root });
  const explicit = `?folder=${encodeURIComponent(root)}`;
  const renamedFolder = await fetch(`${base}/api/folders/Review%20drafts${explicit}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ new_name: 'Renamed drafts', cascade: false }),
  });
  assert.equal(renamedFolder.status, 200);
  assert.deepEqual(revisions.drainPendingProposals(root), [], 'a folder rename retires its old proposal paths');

  const renamedSource = path.join(root, 'Renamed drafts', 'plan.md');
  await revisions.suggestProjectFileEdits(renamedSource, '# Revised again\n', { withinFolder: root });
  const deletedFolder = await fetch(`${base}/api/folders/Renamed%20drafts${explicit}`, { method: 'DELETE' });
  assert.equal(deletedFolder.status, 200);
  assert.deepEqual(revisions.drainPendingProposals(root), [], 'a folder delete retires its proposal paths');
});
