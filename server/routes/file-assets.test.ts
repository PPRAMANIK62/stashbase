import '../__tests__/isolated-home.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { runWithFolderRoot } from '../folder.ts';
import { derivedHtmlPathForDocx } from '../docx.ts';
import { mountFileAssetRoutes } from './file-assets.ts';
import { closeStateDb } from '../state-db.ts';

async function harness(t: { after(fn: () => unknown): void }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-asset-failure-'));
  const app = express();
  app.use((_req, res, next) => {
    void runWithFolderRoot(root, () => new Promise<void>((resolve) => {
      res.once('close', resolve);
      next();
    })).catch(next);
  });
  mountFileAssetRoutes(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeStateDb();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return { root, origin: `http://127.0.0.1:${address.port}` };
}

test('a file disappearing after asset admission returns an error and the server stays responsive', async (t) => {
  const { root, origin } = await harness(t);
  const target = path.join(root, 'gone.png');
  fs.writeFileSync(target, 'image');
  const createReadStream = fs.createReadStream;
  t.mock.method(fs, 'createReadStream', (...args: Parameters<typeof createReadStream>) => {
    if (String(args[0]) === target && fs.existsSync(target)) fs.unlinkSync(target);
    return createReadStream(...args);
  });
  const response = await fetch(`${origin}/asset/gone.png`);
  assert.equal(response.status, 404);
  fs.writeFileSync(path.join(root, 'okay.png'), 'still serving');
  assert.equal(await (await fetch(`${origin}/asset/okay.png`)).text(), 'still serving');
});

test('asset transfer retains Range support and allowed hidden-directory resources', async (t) => {
  const { root, origin } = await harness(t);
  fs.mkdirSync(path.join(root, '.images'));
  fs.writeFileSync(path.join(root, '.images', 'diagram.png'), '0123456789');
  const response = await fetch(`${origin}/asset/.images/diagram.png`, { headers: { range: 'bytes=2-4' } });
  assert.equal(response.status, 206);
  assert.equal(await response.text(), '234');
  assert.equal(response.headers.get('content-type'), 'image/png');
});

test('DOCX fallback serves only current, complete, nonempty prepared HTML', async (t) => {
  const { root, origin } = await harness(t);
  const source = path.join(root, 'document.docx');
  fs.writeFileSync(source, 'DOCX source fixture');
  const derived = derivedHtmlPathForDocx(source);
  fs.mkdirSync(path.dirname(derived), { recursive: true });
  const marker = '<!-- stashbase-docx-conversion: complete -->';
  fs.writeFileSync(derived, `<p>old preview</p>${marker}`);
  fs.utimesSync(derived, new Date(0), new Date(0));
  assert.equal((await fetch(`${origin}/asset-derived/document.docx`)).status, 409);
  fs.writeFileSync(derived, '<p>partial preview</p>');
  assert.equal((await fetch(`${origin}/asset-derived/document.docx`)).status, 409);
  fs.writeFileSync(derived, marker);
  assert.equal((await fetch(`${origin}/asset-derived/document.docx`)).status, 409);
  fs.writeFileSync(derived, `<p>current preview</p>${marker}`);
  const ready = await fetch(`${origin}/asset-derived/document.docx`);
  assert.equal(ready.status, 200);
  assert.match(await ready.text(), /current preview/);
});
