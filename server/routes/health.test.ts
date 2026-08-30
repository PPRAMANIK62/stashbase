import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { Server } from 'node:http';
import test from 'node:test';

import express from 'express';

import {
  serverHealthFailureSchema,
  serverHealthRequestSchema,
  serverHealthSuccessSchema,
} from '../../shared/protocols/http/server-health.ts';
import {
  createServerHealthResponse,
  mountHealthRoute,
} from './health.ts';

function fixture(name: string): unknown {
  const url = new URL(`../../shared/protocols/http/fixtures/${name}`, import.meta.url);
  return JSON.parse(fs.readFileSync(url, 'utf8'));
}

test('health schemas pin the empty request and compatible version-one responses', () => {
  assert.deepEqual(serverHealthRequestSchema.parse({}), {});
  assert.equal(serverHealthRequestSchema.safeParse({ unexpected: true }).success, false);

  const current = serverHealthSuccessSchema.parse(fixture('server-health-v1.json'));
  assert.equal(current.protocolVersion, 1);

  const forward = serverHealthSuccessSchema.parse(fixture('server-health-v1-forward.json'));
  assert.deepEqual(forward, current);

  assert.equal(
    serverHealthSuccessSchema.safeParse(fixture('server-health-incompatible.json')).success,
    false,
  );
  assert.equal(
    serverHealthFailureSchema.parse(fixture('server-health-v1-failure.json')).failure.kind,
    'unavailable',
  );
});

test('the producer validates its success and emits a classified failure if its source is invalid', () => {
  const current = serverHealthSuccessSchema.parse(fixture('server-health-v1.json'));
  assert.deepEqual(
    createServerHealthResponse({
      appRoot: current.appRoot,
      resourcesPath: current.resourcesPath,
      pid: current.pid,
    }),
    { status: 200, body: current },
  );

  const invalid = createServerHealthResponse({
    appRoot: current.appRoot,
    resourcesPath: current.resourcesPath,
    pid: 0,
  });
  assert.equal(invalid.status, 500);
  assert.deepEqual(serverHealthFailureSchema.parse(invalid.body).failure, {
    kind: 'fatal',
    message: 'The local server could not produce a valid health response.',
    code: 'INVALID_HEALTH_PRODUCER',
  });
});

test('the HTTP route emits output accepted by the shared success schema', async (context) => {
  const app = express();
  mountHealthRoute(app, {
    appRoot: '/route/app',
    resourcesPath: '/route/resources',
    pid: 43124,
  });

  const server: Server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(serverHealthSuccessSchema.parse(await response.json()), {
    app: 'stashbase',
    ok: true,
    protocolVersion: 1,
    appRoot: '/route/app',
    resourcesPath: '/route/resources',
    pid: 43124,
  });
});
