import assert from 'node:assert/strict';
import type { Server as HttpServer } from 'node:http';
import test from 'node:test';
import express from 'express';
import { mountInternalShutdownRoute } from './routes/internal-shutdown.ts';

test('internal shutdown requires the process-private token and runs after responding', async (t) => {
  const app = express();
  let shutdowns = 0;
  mountInternalShutdownRoute(app, {
    token: 'private-token',
    shutdown: () => { shutdowns += 1; },
  });
  const server: HttpServer = app.listen(0, '127.0.0.1');
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}/api/internal/shutdown`;

  assert.equal((await fetch(url, { method: 'POST' })).status, 403);
  assert.equal(shutdowns, 0);

  const accepted = await fetch(url, {
    method: 'POST',
    headers: { 'x-stashbase-shutdown-token': 'private-token' },
  });
  assert.equal(accepted.status, 202);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(shutdowns, 1);
});
