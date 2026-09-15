import '../__tests__/isolated-home.ts';
import assert from 'node:assert/strict';
import express from 'express';
import test from 'node:test';
import { getEmbedderConfig } from '../app-config.ts';
import { mount } from './embedder.ts';

test('newer key deletion supersedes a pending provider validation', async (t) => {
  const app = express();
  app.use(express.json());
  mount(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}/api/embedder/key`;
  const realFetch = globalThis.fetch;
  const entered = deferred<void>();
  const check = deferred<Response>();
  globalThis.fetch = async () => { entered.resolve(); return check.promise; };
  t.after(async () => {
    globalThis.fetch = realFetch;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const saving = realFetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'openai', key: 'fixture-old-key' }) });
  await entered.promise;
  const deleted = await realFetch(url, { method: 'DELETE' });
  assert.equal(deleted.status, 200);
  assert.equal(getEmbedderConfig().apiKey, undefined);
  check.resolve(Response.json({ data: [] }));
  const old = await saving;
  assert.equal(old.status, 409);
  assert.equal(getEmbedderConfig().apiKey, undefined);
});

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
