import { describe, expect, it } from 'vite-plus/test';

import { mcpHttpAccess } from '@/test/fakes/settings';

import { formatMcpConfig, isMcpDockerPort, mcpDockerSettling, mcpDockerState } from './mcp-access';

describe('mcpDockerState', () => {
  it('is off while nobody has opted in', () => {
    expect(mcpDockerState(mcpHttpAccess())).toBe('off');
  });

  it('separates a listener that is still coming up from one that refused', () => {
    expect(mcpDockerState(mcpHttpAccess({ dockerAccess: true }))).toBe('starting');
    expect(mcpDockerState(mcpHttpAccess({ dockerAccess: true, dockerError: 'EADDRINUSE' }))).toBe(
      'failed',
    );
  });

  it('reports a live listener as active even when the opt-in never saved', () => {
    // The server can roll a config write back with the listener still up. A
    // host-facing port that is genuinely open is never drawn as off.
    const orphaned = mcpHttpAccess({
      dockerAccess: false,
      dockerActive: true,
      dockerError: 'config write failed and listener rollback failed: EBUSY',
    });
    expect(mcpDockerState(orphaned)).toBe('active');
    expect(mcpDockerState(mcpHttpAccess({ dockerAccess: true, dockerActive: true }))).toBe(
      'active',
    );
  });

  it('has something to wait for only while the listener is starting', () => {
    expect(mcpDockerSettling(mcpHttpAccess({ dockerAccess: true }))).toBe(true);
    expect(mcpDockerSettling(mcpHttpAccess({ dockerAccess: true, dockerActive: true }))).toBe(
      false,
    );
    expect(mcpDockerSettling(mcpHttpAccess())).toBe(false);
  });
});

describe('MCP configuration values', () => {
  it('formats the stdio block the way a client configuration file wants it', () => {
    expect(formatMcpConfig({ mcpServers: { stashbase: { command: '/bin/mcp' } } })).toBe(
      '{\n  "mcpServers": {\n    "stashbase": {\n      "command": "/bin/mcp"\n    }\n  }\n}',
    );
  });

  it('accepts only the unprivileged integer ports the server does', () => {
    expect(isMcpDockerPort(8848)).toBe(true);
    expect(isMcpDockerPort(1024)).toBe(true);
    expect(isMcpDockerPort(65_535)).toBe(true);
    expect(isMcpDockerPort(80)).toBe(false);
    expect(isMcpDockerPort(65_536)).toBe(false);
    expect(isMcpDockerPort(8848.5)).toBe(false);
  });
});
