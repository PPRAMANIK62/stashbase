import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMcpHttpSettingsStore,
  type McpHttpConfigIo,
} from '../mcp-http-settings.ts';
import type { AppConfigFile } from '../app-config.ts';

test('HTTP MCP credentials live in app config and can be rotated from Settings', () => {
  let config: AppConfigFile = {};
  const writes: AppConfigFile[] = [];
  const io: McpHttpConfigIo = {
    read: () => structuredClone(config),
    write: (next) => {
      config = structuredClone(next);
      writes.push(structuredClone(next));
    },
  };
  const tokens = ['a'.repeat(64), 'b'.repeat(64)];
  const store = createMcpHttpSettingsStore(io, () => tokens.shift()!);

  const initial = store.ensure();
  assert.equal(initial.token, 'a'.repeat(64));
  assert.equal(initial.dockerAccess, false);
  assert.deepEqual(config.mcpHttp, {
    token: 'a'.repeat(64),
    dockerAccess: false,
    dockerPort: 8091,
  });

  const rotated = store.rotateToken();
  assert.equal(rotated.token, 'b'.repeat(64));
  assert.equal(store.current().token, 'b'.repeat(64));
  assert.equal(writes.length, 2);
});

test('invalid legacy token state is replaced and Docker access persists explicitly', () => {
  let config: AppConfigFile = {
    mcpHttp: { token: 'short', dockerAccess: true },
  };
  const io: McpHttpConfigIo = {
    read: () => structuredClone(config),
    write: (next) => { config = structuredClone(next); },
  };
  const store = createMcpHttpSettingsStore(io, () => 'c'.repeat(64));

  assert.deepEqual(store.ensure(), {
    token: 'c'.repeat(64),
    dockerAccess: true,
    dockerPort: 8091,
  });
  assert.equal(store.setDockerAccess(false).dockerAccess, false);
  assert.equal(config.mcpHttp?.dockerAccess, false);
});

test('invalid generated credentials fail closed instead of being persisted', () => {
  const io: McpHttpConfigIo = {
    read: () => ({}),
    write: () => assert.fail('invalid token must not be written'),
  };
  const store = createMcpHttpSettingsStore(io, () => 'not-a-token');
  assert.throws(() => store.ensure(), /invalid token/);
});

test('a corrupt config read fails closed without overwriting user settings', () => {
  let writes = 0;
  const io: McpHttpConfigIo = {
    read: () => { throw new Error('config.json is invalid JSON'); },
    write: () => { writes += 1; },
  };
  const store = createMcpHttpSettingsStore(io, () => 'a'.repeat(64));
  assert.throws(() => store.ensure(), /invalid JSON/);
  assert.equal(writes, 0);
});

test('Docker port is persisted only when valid', () => {
  let config: AppConfigFile = {};
  const io: McpHttpConfigIo = {
    read: () => structuredClone(config),
    write: (next) => { config = structuredClone(next); },
  };
  const store = createMcpHttpSettingsStore(io, () => 'a'.repeat(64));
  store.ensure();
  assert.equal(store.setDockerPort(18_431).dockerPort, 18_431);
  assert.equal(config.mcpHttp?.dockerPort, 18_431);
  assert.throws(() => store.setDockerPort(80), /1024/);
});
