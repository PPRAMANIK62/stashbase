import assert from 'node:assert/strict';
import { test } from 'node:test';

import express from 'express';

import { mount } from './workspace-preferences.ts';

async function put(body: unknown): Promise<number> {
  const app = express();
  app.use(express.json());
  mount(app);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/workspace-preferences`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'PUT',
    });
    return res.status;
  } finally {
    server.close();
  }
}

// A refusal is also the proof the durable writer was never reached: the route
// answers before it calls into app config.
test('an unknown preference is refused rather than written to durable config', async () => {
  assert.equal(await put({ rogue: 1, showHiddenFiles: true }), 400);
});

test('a non-boolean visibility is refused', async () => {
  assert.equal(await put({ showHiddenFiles: 'yes' }), 400);
  assert.equal(await put({ showHiddenFiles: 1 }), 400);
});

test('an empty body is refused rather than accepted as a no-op write', async () => {
  assert.equal(await put({}), 400);
});
