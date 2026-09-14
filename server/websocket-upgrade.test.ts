import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { WebSocket, WebSocketServer } from 'ws';
import { createWebSocketUpgradeHandler, type WebSocketUpgrade } from './websocket-upgrade.ts';

test('real upgrades accept only the canonical Agent path and explicit Vite root', async () => {
  const upstream = http.createServer((_request, response) => response.end('Vite fixture'));
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const upstreamAddress = upstream.address();
  assert.ok(upstreamAddress && typeof upstreamAddress !== 'string');
  const proxy = createProxyMiddleware({ target: `http://127.0.0.1:${upstreamAddress.port}` });
  const server = http.createServer(proxy);
  const sockets = new WebSocketServer({ noServer: true });
  const accepted: string[] = [];
  upstream.on('upgrade', (request, socket, head) => {
    accepted.push('vite');
    sockets.handleUpgrade(request, socket, head, (ws) => ws.close());
  });
  let viteEnabled = false;
  const handler = () => createWebSocketUpgradeHandler({
    allowedOrigins: new Set(['app://renderer']),
    agentUpgrade: (request, socket, head) => {
      accepted.push('agent');
      sockets.handleUpgrade(request, socket, head, (ws) => ws.close());
    },
    ...(viteEnabled ? {
      viteUpgrade: proxy.upgrade as unknown as WebSocketUpgrade,
    } : {}),
  });
  server.on('upgrade', (request, socket, head) => handler()(request, socket, head));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const connect = (path: string, origin = 'app://renderer') => new Promise<boolean>((resolve) => {
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}${path}`, { origin });
    socket.on('open', () => { socket.close(); resolve(true); });
    socket.on('error', () => resolve(false));
  });
  try {
    assert.equal(await connect('/ws/agent?agent=codex'), true);
    for (const path of ['/ws/codex', '/ws/agent-extra', '/ws/agent/extra', '/WS/agent', '/?token=test']) {
      assert.equal(await connect(path), false, path);
    }
    assert.equal(await connect('/ws/agent', 'https://example.com'), false);
    viteEnabled = true;
    const page = await fetch(`http://127.0.0.1:${address.port}/`);
    assert.equal(await page.text(), 'Vite fixture');
    assert.equal(server.listenerCount('upgrade'), 1);
    assert.equal(await connect('/?token=test'), true);
    assert.equal(await connect('/ws/codex'), false);
    assert.deepEqual(accepted, ['agent', 'vite']);
  } finally {
    for (const socket of sockets.clients) socket.terminate();
    sockets.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    upstream.closeAllConnections();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
});
