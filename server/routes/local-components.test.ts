import '../__tests__/isolated-home.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { mount } from './local-components.ts';
import { localComponentStatusSchema } from '../../shared/protocols/http/local-components.ts';

test('Settings reads do not retry, Retry is explicit and accepts no runtime options', async (t) => {
  let retries = 0;
  const app = express(); app.use(express.json());
  mount(app, {
    status: async () => ({ status: 'failed' as const, error: 'network' as const }),
    retry: async () => { retries++; return { status: 'downloading' as const, error: null }; },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/local-components/extractor`;
  const status = localComponentStatusSchema.parse(await (await fetch(url)).json());
  assert.equal(status.error, 'network'); assert.equal(retries, 0);
  const post = (body: unknown) => fetch(`${url}/retry`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post({ url: 'https://untrusted.example/binary' })).status, 400);
  assert.equal(retries, 0);
  const result = await post({}); assert.equal(result.status, 202);
  assert.equal(localComponentStatusSchema.parse(await result.json()).status, 'downloading');
  assert.equal(retries, 1);
});
