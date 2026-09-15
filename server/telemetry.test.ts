import './__tests__/isolated-home.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AppConfigFile } from './app-config.ts';
import { createTelemetry } from './telemetry.ts';
import { mount } from './routes/telemetry.ts';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function fixture(available = true) {
  let config: AppConfigFile = { updates: { autoCheck: false } };
  let readFails = false;
  let writeFails = false;
  let now = Date.UTC(2026, 8, 15);
  const sent: Array<{ body: Record<string, any>; signal: AbortSignal }> = [];
  const options = {
    available, projectToken: 'phc_test', host: 'https://example.test', version: '2.7.0', os: 'linux',
    read() { if (readFails) throw new Error('private config path'); return structuredClone(config); },
    write(next: AppConfigFile) { if (writeFails) throw new Error('private config path'); config = structuredClone(next); },
    now: () => now,
    fetch: (async (_url, init) => {
      sent.push({ body: JSON.parse(String(init?.body)), signal: init?.signal as AbortSignal });
      return new Response(null, { status: 200 });
    }) as typeof fetch,
  };
  return { service: createTelemetry(options), options, sent,
    config: () => config,
    setConfig: (next: AppConfigFile) => { config = next; },
    readFails: () => { readFails = true; },
    writeFails: () => { writeFails = true; },
    nextDay: () => { now += 86400000; },
  };
}

test('default-on manual collection has only allowed fields and no source or account data', async () => {
  const f = fixture();
  assert.equal(f.service.preferences().enabled, true);
  f.service.capture({ event: 'app_opened' });
  f.service.capture({ event: 'app_opened' });
  f.service.capture({ event: 'project_entry_result', outcome: 'success', path: '/private' } as any);
  await tick();
  assert.equal(f.sent.length, 1);
  assert.deepEqual(f.sent[0].body.properties, { app_version: '2.7.0', os: 'linux', schema_version: 1,
    $process_person_profile: false, $geoip_disable: true, $ip: null });
  assert.equal(f.sent[0].body.distinct_id, f.config().telemetry?.installationId);
  assert.deepEqual(f.config().updates, { autoCheck: false });
  f.service.close();
});

test('opt-out persists first, discards pending events, sends one final signal, and rotates on re-enable', async () => {
  const f = fixture();
  f.service.capture({ event: 'app_opened' });
  await tick();
  const oldId = f.sent[0].body.distinct_id;
  f.service.capture({ event: 'agent_turn_started', runtime: 'codex' });
  assert.equal(f.service.update({ enabled: false }).enabled, false);
  assert.equal(f.config().telemetry?.installationId, undefined);
  f.service.capture({ event: 'agent_turn_started', runtime: 'codex' });
  await tick();
  assert.deepEqual(f.sent.map((entry) => entry.body.event), ['app_opened', 'telemetry_disabled']);
  assert.equal(f.sent[1].body.distinct_id, oldId);
  const restarted = createTelemetry(f.options);
  restarted.capture({ event: 'app_opened' });
  await tick();
  assert.equal(f.sent.length, 2);
  restarted.update({ enabled: true });
  restarted.capture({ event: 'app_opened' });
  await tick();
  assert.notEqual(f.sent[2].body.distinct_id, oldId);
  f.service.close(); restarted.close();
});

test('read errors, malformed preferences, development builds, and failed disable persistence do not send', async () => {
  for (const kind of ['read', 'malformed', 'dev', 'write'] as const) {
    const f = fixture(kind !== 'dev');
    if (kind === 'read') f.readFails();
    if (kind === 'malformed') f.setConfig({ telemetry: { enabled: 'yes' } as any });
    if (kind === 'write') {
      f.writeFails();
      assert.throws(() => f.service.update({ enabled: false }));
    }
    f.service.capture({ event: 'app_opened' });
    await tick();
    assert.equal(f.sent.length, 0, kind);
    f.service.close();
  }
});

test('document saves are coalesced across process restarts and reset on the next UTC day', async () => {
  const f = fixture();
  for (let i = 0; i < 50; i++) f.service.capture({ event: 'document_write_result', outcome: 'success' });
  f.service.capture({ event: 'document_write_result', outcome: 'conflict' });
  await tick();
  assert.equal(f.sent.length, 2);
  const restarted = createTelemetry(f.options);
  restarted.capture({ event: 'document_write_result', outcome: 'success' });
  await tick();
  assert.equal(f.sent.length, 2);
  f.nextDay();
  restarted.capture({ event: 'document_write_result', outcome: 'success' });
  await tick();
  assert.equal(f.sent.length, 3);
  restarted.close(); f.service.close();
});

test('offline final notifications are attempted once without blocking preferences or retrying', async () => {
  const f = fixture();
  let calls = 0;
  const service = createTelemetry({ ...f.options, fetch: (async () => { calls++; throw new Error('offline'); }) as typeof fetch });
  service.capture({ event: 'app_opened' });
  await tick();
  service.update({ enabled: false });
  await tick(); await tick();
  assert.equal(calls, 2);
  assert.equal(service.preferences().enabled, false);
  service.close();
});

test('HTTP boundary refuses arbitrary fields and never exposes the installation ID', async () => {
  const f = fixture();
  const app = express(); app.use(express.json()); mount(app, f.service);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}/api/telemetry`;
  try {
    const post = (path: string, body: unknown, method = 'POST') => fetch(url + path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post('/events', { event: 'agent_turn_started', runtime: 'codex', prompt: 'private' })).status, 400);
    assert.equal((await post('', { enabled: false, installationId: 'injected' }, 'PUT')).status, 400);
    assert.equal((await post('/events', { event: 'app_opened' })).status, 204);
    assert.deepEqual(await (await fetch(url)).json(), { enabled: true, available: true });
    assert.equal((await post('', { enabled: false }, 'PUT')).status, 200);
    assert.equal(f.config().telemetry?.enabled, false);
  } finally { f.service.close(); server.closeAllConnections(); server.close(); }
});
