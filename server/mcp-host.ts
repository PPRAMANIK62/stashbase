import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path';
import { logger, errorMessage } from './log.ts';
import { getKbRoot, resolveSpaceConfig } from './space.ts';

const log = logger('mcp-host');

export interface HostedMcpTool {
  server: string;
  name: string;
  fqName: string;
  description?: string;
  inputSchema: unknown;
}

interface ManagedServer {
  name: string;
  client: ManagedMcpClient;
  ready: Promise<void>;
  tools: HostedMcpTool[];
  generation: number;
  error?: string;
}

interface ManagedMcpClient {
  close(): Promise<void>;
  callTool(request: { name: string; arguments: Record<string, unknown> }): Promise<unknown>;
}

const byWindow = new Map<string, ManagedServer[]>();
const windowGeneration = new Map<string, number>();

export async function switchSpaceMcpServers(windowId: string, spaceRoot: string): Promise<void> {
  const generation = bumpWindowGeneration(windowId);
  await closeWindowServers(windowId);
  if (generation !== currentWindowGeneration(windowId)) return;
  const spaceName = path.relative(getKbRoot(), spaceRoot).split(path.sep).join('/');
  const cfg = resolveSpaceConfig(spaceName);
  const servers: ManagedServer[] = [];
  for (const [name, server] of Object.entries(cfg.mcpServers)) {
    const env = cleanEnv({ ...process.env, ...(server.env ?? {}) });
    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args ?? [],
      cwd: spaceRoot,
      env,
      stderr: 'pipe',
    });
    transport.stderr?.on('data', (chunk) => {
      log.warn(`${spaceName}/${name}: ${chunk.toString('utf8').trimEnd()}`);
    });
    const client = new Client({ name: `stashbase-${name}`, version: '0.1.0' }, { capabilities: {} });
    const managed: ManagedServer = { name, client, tools: [], ready: Promise.resolve(), generation };
    managed.ready = client.connect(transport)
      .then(async () => {
        const listed = await client.listTools();
        managed.tools = listed.tools.map((tool) => ({
          server: name,
          name: tool.name,
          fqName: `${name}/${tool.name}`,
          description: tool.description,
          inputSchema: tool.inputSchema,
        }));
        log.info(`${spaceName}/${name}: ready with ${managed.tools.length} tool(s)`);
      })
      .catch((err) => {
        managed.error = errorMessage(err);
        log.warn(`${spaceName}/${name}: connect failed: ${managed.error}`);
    });
    servers.push(managed);
  }
  if (!(await commitWindowServersIfCurrent(windowId, generation, servers))) return;
  if (servers.length > 0) {
    log.info(`starting ${servers.length} MCP server(s) for ${spaceName} in ${windowId}`);
  }
}

export async function stopSpaceMcpServers(windowId?: string): Promise<void> {
  if (windowId) {
    bumpWindowGeneration(windowId);
    await closeWindowServers(windowId);
    return;
  }
  const entries = windowId ? [[windowId, byWindow.get(windowId) ?? []] as const] : [...byWindow.entries()];
  for (const [id] of entries) bumpWindowGeneration(id);
  await closeWindowServerEntries(entries);
}

async function closeWindowServers(windowId: string): Promise<void> {
  await closeWindowServerEntries([[windowId, byWindow.get(windowId) ?? []] as const]);
}

async function closeWindowServerEntries(entries: ReadonlyArray<readonly [string, ManagedServer[]]>): Promise<void> {
  const closes: Promise<void>[] = [];
  for (const [id, servers] of entries) {
    closes.push(closeManagedServers(servers));
    byWindow.delete(id);
  }
  await Promise.all(closes);
}

async function closeManagedServers(servers: ManagedServer[]): Promise<void> {
  await Promise.all(servers.map((server) =>
    server.client.close().catch((err) => {
      log.warn(`${server.name}: close failed: ${errorMessage(err)}`);
    }),
  ));
}

async function commitWindowServersIfCurrent(
  windowId: string,
  generation: number,
  servers: ManagedServer[],
): Promise<boolean> {
  if (generation !== currentWindowGeneration(windowId)) {
    await closeManagedServers(servers);
    return false;
  }
  byWindow.set(windowId, servers);
  return true;
}

export async function listSpaceMcpTools(windowId: string): Promise<HostedMcpTool[]> {
  const generation = currentWindowGeneration(windowId);
  const servers = byWindow.get(windowId) ?? [];
  await Promise.all(servers.map((server) => server.ready));
  if (generation !== currentWindowGeneration(windowId) || servers !== (byWindow.get(windowId) ?? [])) {
    return [];
  }
  return servers.flatMap((server) => server.tools);
}

export async function callSpaceMcpTool(
  windowId: string,
  fqName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const slash = fqName.indexOf('/');
  if (slash <= 0 || slash === fqName.length - 1) {
    throw new Error('tool name must be "<server>/<tool>"');
  }
  const serverName = fqName.slice(0, slash);
  const toolName = fqName.slice(slash + 1);
  const generation = currentWindowGeneration(windowId);
  const servers = byWindow.get(windowId) ?? [];
  const server = servers.find((candidate) => candidate.name === serverName);
  if (!server) throw new Error(`MCP server not running: ${serverName}`);
  await server.ready;
  if (
    generation !== currentWindowGeneration(windowId) ||
    server.generation !== generation ||
    servers !== (byWindow.get(windowId) ?? [])
  ) {
    throw new Error('MCP server changed; retry the request.');
  }
  if (server.error) throw new Error(`MCP server failed: ${serverName}: ${server.error}`);
  return server.client.callTool({ name: toolName, arguments: args });
}

function bumpWindowGeneration(windowId: string): number {
  const next = (windowGeneration.get(windowId) ?? 0) + 1;
  windowGeneration.set(windowId, next);
  return next;
}

function currentWindowGeneration(windowId: string): number {
  return windowGeneration.get(windowId) ?? 0;
}

export function __setMcpServersForTest(
  windowId: string,
  servers: Array<{
    name: string;
    ready?: Promise<void>;
    tools?: HostedMcpTool[];
    error?: string;
    close?: () => Promise<void>;
    callTool?: (request: { name: string; arguments: Record<string, unknown> }) => Promise<unknown>;
  }>,
): () => void {
  const generation = bumpWindowGeneration(windowId);
  byWindow.set(windowId, servers.map((server) => ({
    name: server.name,
    ready: server.ready ?? Promise.resolve(),
    tools: server.tools ?? [],
    error: server.error,
    generation,
    client: {
      close: server.close ?? (async () => undefined),
      callTool: server.callTool ?? (async () => ({})),
    },
  })));
  return () => {
    if (currentWindowGeneration(windowId) === generation) {
      bumpWindowGeneration(windowId);
      byWindow.delete(windowId);
    }
  };
}

export function __bumpMcpGenerationForTest(windowId: string): number {
  return bumpWindowGeneration(windowId);
}

export async function __commitMcpServersForGenerationForTest(
  windowId: string,
  generation: number,
  servers: Array<{
    name: string;
    ready?: Promise<void>;
    tools?: HostedMcpTool[];
    close?: () => Promise<void>;
  }>,
): Promise<boolean> {
  return commitWindowServersIfCurrent(windowId, generation, servers.map((server) => ({
    name: server.name,
    ready: server.ready ?? Promise.resolve(),
    tools: server.tools ?? [],
    generation,
    client: {
      close: server.close ?? (async () => undefined),
      callTool: async () => ({}),
    },
  })));
}

function cleanEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}
