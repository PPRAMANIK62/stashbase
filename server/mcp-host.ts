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
  client: Client;
  ready: Promise<void>;
  tools: HostedMcpTool[];
  error?: string;
}

const byWindow = new Map<string, ManagedServer[]>();

export async function switchSpaceMcpServers(windowId: string, spaceRoot: string): Promise<void> {
  await stopSpaceMcpServers(windowId);
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
    const managed: ManagedServer = { name, client, tools: [], ready: Promise.resolve() };
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
  byWindow.set(windowId, servers);
  if (servers.length > 0) {
    log.info(`starting ${servers.length} MCP server(s) for ${spaceName} in ${windowId}`);
  }
}

export async function stopSpaceMcpServers(windowId?: string): Promise<void> {
  const entries = windowId ? [[windowId, byWindow.get(windowId) ?? []] as const] : [...byWindow.entries()];
  const closes: Promise<void>[] = [];
  for (const [id, servers] of entries) {
    for (const server of servers) {
      closes.push(
        server.client.close().catch((err) => {
          log.warn(`${server.name}: close failed: ${errorMessage(err)}`);
        }),
      );
    }
    byWindow.delete(id);
  }
  await Promise.all(closes);
}

export async function listSpaceMcpTools(windowId: string): Promise<HostedMcpTool[]> {
  const servers = byWindow.get(windowId) ?? [];
  await Promise.all(servers.map((server) => server.ready));
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
  const server = (byWindow.get(windowId) ?? []).find((candidate) => candidate.name === serverName);
  if (!server) throw new Error(`MCP server not running: ${serverName}`);
  await server.ready;
  if (server.error) throw new Error(`MCP server failed: ${serverName}: ${server.error}`);
  return server.client.callTool({ name: toolName, arguments: args });
}

function cleanEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}
