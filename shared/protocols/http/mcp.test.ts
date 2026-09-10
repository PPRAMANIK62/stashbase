import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mcpDockerPortRequestSchema,
  mcpHttpWriteResponseSchema,
  mcpStatusSchema,
} from './mcp.ts';

const httpStatus = {
  dockerAccess: false,
  dockerActive: false,
  dockerPort: 8848,
  dockerUrl: 'http://host.docker.internal:8848/mcp',
  loopbackUrl: 'http://127.0.0.1:7777/mcp',
  token: 'abc123',
};

test('status carries the launcher, the pasteable config, and the listener state', () => {
  const parsed = mcpStatusSchema.parse({
    command: '/home/ada/.stashbase/bin/stashbase-mcp',
    config: { mcpServers: { stashbase: { command: '/home/ada/.stashbase/bin/stashbase-mcp' } } },
    http: httpStatus,
  });
  assert.equal(parsed.http.token, 'abc123');
  assert.equal(parsed.http.dockerPort, 8848);
});

test('an unreadable credential parses as null, and a broken listener keeps its reason', () => {
  const parsed = mcpHttpWriteResponseSchema.parse({
    http: {
      ...httpStatus,
      dockerAccess: true,
      dockerError: 'listen EADDRINUSE: address already in use 0.0.0.0:8848',
      settingsError: 'mcp-http.json is malformed',
      token: null,
    },
    ok: true,
  });
  assert.equal(parsed.http.token, null);
  assert.match(parsed.http.dockerError ?? '', /EADDRINUSE/);
  assert.equal(parsed.http.settingsError, 'mcp-http.json is malformed');
});

test('the write bodies refuse a missing token field and a privileged port', () => {
  assert.equal(mcpStatusSchema.safeParse({ command: 'x', config: {}, http: {} }).success, false);
  assert.equal(mcpDockerPortRequestSchema.safeParse({ port: 8848 }).success, true);
  assert.equal(mcpDockerPortRequestSchema.safeParse({ port: 80 }).success, false);
  assert.equal(mcpDockerPortRequestSchema.safeParse({ port: 8848.5 }).success, false);
  assert.equal(mcpDockerPortRequestSchema.safeParse({ port: 8848, extra: 1 }).success, false);
});
