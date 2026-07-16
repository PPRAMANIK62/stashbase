import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMcpHttpService,
  type DockerMcpListener,
  type DockerMcpListenerFactory,
} from '../mcp-http-service.ts';
import type { McpHttpSettings, McpHttpSettingsStore } from '../mcp-http-settings.ts';

function memorySettings(initial: McpHttpSettings): McpHttpSettingsStore {
  let current = { ...initial };
  return {
    ensure: () => ({ ...current }),
    current: () => ({ ...current }),
    rotateToken: () => {
      current = { ...current, token: 'b'.repeat(64) };
      return { ...current };
    },
    setDockerAccess: (enabled) => {
      current = { ...current, dockerAccess: enabled };
      return { ...current };
    },
    setDockerPort: (port) => {
      current = { ...current, dockerPort: port };
      return { ...current };
    },
  };
}

test('Docker listener is disabled by default and binds only the MCP-only port when opted in', async () => {
  const events: string[] = [];
  const factory: DockerMcpListenerFactory = async ({ host, port }) => {
    events.push(`listen:${host}:${port}`);
    const listener: DockerMcpListener = {
      port,
      close: async () => { events.push('close'); },
    };
    return listener;
  };
  const service = createMcpHttpService({
    webPort: 8090,
    dockerPort: 8091,
    settings: memorySettings({ token: 'a'.repeat(64), dockerAccess: false, dockerPort: 8091 }),
    openDockerListener: factory,
  });

  await service.start();
  assert.deepEqual(events, []);
  assert.deepEqual(service.status(), {
    loopbackUrl: 'http://127.0.0.1:8090/mcp',
    dockerUrl: 'http://host.docker.internal:8091/mcp',
    dockerPort: 8091,
    token: 'a'.repeat(64),
    dockerAccess: false,
    dockerActive: false,
  });

  await service.setDockerAccess(true);
  assert.deepEqual(events, ['listen:0.0.0.0:8091']);
  assert.equal(service.status().dockerActive, true);

  await service.setDockerAccess(false);
  assert.deepEqual(events, ['listen:0.0.0.0:8091', 'close']);
  assert.equal(service.status().dockerActive, false);
});

test('failed Docker bind does not persist an enabled state', async () => {
  const settings = memorySettings({ token: 'a'.repeat(64), dockerAccess: false, dockerPort: 8091 });
  const service = createMcpHttpService({
    webPort: 8090,
    dockerPort: 8091,
    settings,
    openDockerListener: async () => { throw new Error('address in use'); },
  });

  await service.start();
  await assert.rejects(service.setDockerAccess(true), /address in use/);
  assert.equal(settings.current().dockerAccess, false);
  assert.equal(service.status().dockerActive, false);
});

test('concurrent enable requests share one listener transition', async () => {
  let opens = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const service = createMcpHttpService({
    webPort: 8090,
    settings: memorySettings({ token: 'a'.repeat(64), dockerAccess: false, dockerPort: 8091 }),
    openDockerListener: async ({ port }) => {
      opens += 1;
      await gate;
      return { port, close: async () => undefined };
    },
  });
  await service.start();
  const first = service.setDockerAccess(true);
  const second = service.setDockerAccess(true);
  await new Promise((resolve) => setTimeout(resolve, 10));
  release();
  await Promise.all([first, second]);
  assert.equal(opens, 1);
});

test('enable rolls the listener back when config persistence fails', async () => {
  let closes = 0;
  const base = memorySettings({ token: 'a'.repeat(64), dockerAccess: false, dockerPort: 8091 });
  const settings: McpHttpSettingsStore = {
    ...base,
    setDockerAccess: () => { throw new Error('disk full'); },
  };
  const service = createMcpHttpService({
    webPort: 8090,
    settings,
    openDockerListener: async ({ port }) => ({
      port,
      close: async () => { closes += 1; },
    }),
  });
  await service.start();
  await assert.rejects(service.setDockerAccess(true), /disk full/);
  assert.equal(closes, 1);
  assert.equal(service.status().dockerActive, false);
  assert.equal(settings.current().dockerAccess, false);
});

test('disable does not close an active listener when persistence fails', async () => {
  const base = memorySettings({ token: 'a'.repeat(64), dockerAccess: true, dockerPort: 8091 });
  let closes = 0;
  let rejectWrites = false;
  const settings: McpHttpSettingsStore = {
    ...base,
    setDockerAccess: (enabled) => {
      if (rejectWrites) throw new Error('disk full');
      return base.setDockerAccess(enabled);
    },
  };
  const service = createMcpHttpService({
    webPort: 8090,
    settings,
    openDockerListener: async ({ port }) => ({ port, close: async () => { closes += 1; } }),
  });
  await service.start();
  rejectWrites = true;
  await assert.rejects(service.setDockerAccess(false), /disk full/);
  assert.equal(closes, 0);
  assert.equal(service.status().dockerActive, true);
  assert.equal(settings.current().dockerAccess, true);
});

test('Docker port can be changed while disabled and is used by the next listener', async () => {
  const opened: number[] = [];
  const service = createMcpHttpService({
    webPort: 8090,
    settings: memorySettings({ token: 'a'.repeat(64), dockerAccess: false, dockerPort: 8091 }),
    openDockerListener: async ({ port }) => {
      opened.push(port);
      return { port, close: async () => undefined };
    },
  });
  await service.start();
  await service.setDockerPort(18_431);
  await service.setDockerAccess(true);
  assert.deepEqual(opened, [18_431]);
  assert.equal(service.status().dockerPort, 18_431);
  await assert.rejects(service.setDockerPort(18_432), /Disable Docker access/);
});

test('settings failures stay closed and status recovers after config repair', () => {
  const value = { token: 'a'.repeat(64), dockerAccess: false, dockerPort: 8091 };
  let repaired = false;
  let initialized = false;
  const settings: McpHttpSettingsStore = {
    ensure: () => {
      if (!repaired) throw new Error('config.json is invalid JSON');
      initialized = true;
      return { ...value };
    },
    current: () => {
      if (!initialized) throw new Error('not initialized');
      return { ...value };
    },
    rotateToken: () => ({ ...value }),
    setDockerAccess: () => ({ ...value }),
    setDockerPort: () => ({ ...value }),
  };
  const service = createMcpHttpService({ webPort: 8090, settings });

  assert.equal(service.status().token, null);
  assert.match(service.status().settingsError ?? '', /invalid JSON/);
  repaired = true;
  assert.equal(service.status().token, value.token);
  assert.equal(service.status().settingsError, undefined);
});
