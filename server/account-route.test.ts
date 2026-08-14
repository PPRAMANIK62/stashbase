import assert from 'node:assert/strict';
import type { Server as HttpServer } from 'node:http';
import test from 'node:test';
import express from 'express';
import {
  beginHostedOAuth,
  failHostedOAuth,
  hostedOAuthStatus,
} from './hosted-account.ts';
import { mount as mountAccountRoutes } from './routes/account.ts';

test('OAuth app-return proof requires the Electron process-private token', async (t) => {
  const app = express();
  const flow = beginHostedOAuth('google', 'http://127.0.0.1:8090');
  failHostedOAuth(flow.flowId, 'expected test failure');
  mountAccountRoutes(app, { appReturnToken: 'private-return-token' });

  const server: HttpServer = app.listen(0, '127.0.0.1');
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}/api/account/oauth/app-return`;

  assert.equal((await fetch(url, { method: 'POST' })).status, 403);
  assert.equal(hostedOAuthStatus(flow.flowId).appReturned, undefined);

  assert.equal((await fetch(url, {
    method: 'POST',
    headers: { 'x-stashbase-oauth-return-token': 'wrong-token' },
  })).status, 403);
  assert.equal(hostedOAuthStatus(flow.flowId).appReturned, undefined);

  const accepted = await fetch(url, {
    method: 'POST',
    headers: { 'x-stashbase-oauth-return-token': 'private-return-token' },
  });
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), { acknowledged: true });
  assert.equal(hostedOAuthStatus(flow.flowId).appReturned, true);
});
