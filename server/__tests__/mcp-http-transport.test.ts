import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { mount } from '../routes/mcp-http.ts';
import { createDockerMcpApp, createMcpHttpService } from '../mcp-http-service.ts';
import type { McpHttpSettingsStore } from '../mcp-http-settings.ts';

const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'test', version: '1' },
  },
};

const listRequest = {
  jsonrpc: '2.0', id: 2, method: 'tools/list', params: {},
};

const callRequest = {
  jsonrpc: '2.0', id: 3, method: 'tools/call',
  params: { name: 'library_info', arguments: {} },
};

test('HTTP transport enforces the live Settings token and preserves the shared tool surface', async () => {
  let token = 'a'.repeat(64);
  const app = express();
  app.use(express.json());
  app.get('/api/library/info', (_req, res) => {
    res.json({ folder_home: '/tmp', folders: [] });
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  mount(app, { webBase: base, getToken: () => token });

  try {
    const unauthorized = await post(base, initRequest);
    assert.equal(unauthorized.status, 401);

    const initialized = await post(base, initRequest, token);
    assert.equal(initialized.status, 200);
    assert.equal(initialized.body.result.serverInfo.name, 'stashbase');

    const listed = await post(base, listRequest, token);
    assert.equal(listed.status, 200);
    assert.equal(listed.body.result.tools.length, 9);

    const called = await post(base, callRequest, token);
    assert.equal(called.status, 200);

    const stdio = await runStdio(address.port);
    assert.equal(stdio.initialized.result.serverInfo.name, 'stashbase');
    assert.deepEqual(stdio.listed.result.tools, listed.body.result.tools);
    assert.deepEqual(stdio.called.result, called.body.result);

    token = 'b'.repeat(64);
    assert.equal((await post(base, initRequest, 'a'.repeat(64))).status, 401);
    assert.equal((await post(base, initRequest, token)).status, 200);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Docker-facing app exposes only the MCP transport', async () => {
  const app = createDockerMcpApp({
    webBase: 'http://127.0.0.1:9',
    getToken: () => 'a'.repeat(64),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    const health = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    assert.equal(health.status, 404);
    const mcp = await fetch(`http://127.0.0.1:${address.port}/mcp`, { method: 'POST' });
    assert.equal(mcp.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('production Docker listener binds host interfaces and reports its actual port', async () => {
  const token = 'a'.repeat(64);
  let current = { token, dockerAccess: true, dockerPort: 8091 };
  const settings: McpHttpSettingsStore = {
    ensure: () => ({ ...current }),
    current: () => ({ ...current }),
    rotateToken: () => ({ ...current }),
    setDockerAccess: (enabled) => (current = { ...current, dockerAccess: enabled }),
    setDockerPort: (dockerPort) => (current = { ...current, dockerPort }),
  };
  const service = createMcpHttpService({ webPort: 9, dockerPort: 0, settings });
  try {
    await service.start();
    const status = service.status();
    assert.equal(status.dockerActive, true);
    assert.ok(status.dockerPort > 0);
    const response = await fetch(`http://127.0.0.1:${status.dockerPort}/mcp`, { method: 'POST' });
    assert.equal(response.status, 401);
  } finally {
    await service.close();
  }
});

async function post(base: string, body: unknown, token?: string): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function waitForJsonLines(read: () => string, count: number): Promise<any[]> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const lines = read().trim().split('\n').filter(Boolean);
    if (lines.length >= count) return lines.slice(0, count).map((line) => JSON.parse(line));
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`timed out waiting for ${count} JSON lines: ${read()}`);
}

async function runStdio(port: number): Promise<{ initialized: any; listed: any; called: any }> {
  const { spawn } = await import('node:child_process');
  const entry = fileURLToPath(new URL('../../mcp/server.ts', import.meta.url));
  const child = spawn(process.execPath, ['--import', 'tsx', entry, '--port', String(port)], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.stdin.write(`${JSON.stringify(initRequest)}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  child.stdin.write(`${JSON.stringify(listRequest)}\n`);
  child.stdin.write(`${JSON.stringify(callRequest)}\n`);

  try {
    const lines = await waitForJsonLines(() => stdout, 3);
    return { initialized: lines[0], listed: lines[1], called: lines[2] };
  } catch (err) {
    throw new Error(`${err instanceof Error ? err.message : String(err)}\nstderr: ${stderr}`);
  } finally {
    child.kill();
  }
}
