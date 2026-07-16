/**
 * Durable Settings state for the Streamable HTTP MCP transport.
 *
 * This module is deliberately transport-free. The web-server process is the
 * only config writer; routes and listeners consume this small store so token
 * rotation takes effect without restarting or rebuilding a transport.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readAppConfigStrict,
  writeAppConfigStrict,
  type AppConfigFile,
} from './app-config.ts';

export interface McpHttpSettings {
  token: string;
  dockerAccess: boolean;
  dockerPort: number;
}

export interface McpHttpConfigIo {
  read(): AppConfigFile;
  write(config: AppConfigFile): void;
}

export interface McpHttpSettingsStore {
  ensure(): McpHttpSettings;
  current(): McpHttpSettings;
  rotateToken(): McpHttpSettings;
  setDockerAccess(enabled: boolean): McpHttpSettings;
  setDockerPort(port: number): McpHttpSettings;
}

const defaultIo: McpHttpConfigIo = {
  read: readAppConfigStrict,
  write: writeAppConfigStrict,
};

export const DEFAULT_MCP_DOCKER_PORT = 8091;

export function createMcpHttpSettingsStore(
  io: McpHttpConfigIo = defaultIo,
  tokenFactory: () => string = () => crypto.randomBytes(32).toString('hex'),
): McpHttpSettingsStore {
  let cached: McpHttpSettings | null = null;

  function ensure(): McpHttpSettings {
    if (cached) return { ...cached };
    const config = io.read();
    const current = config.mcpHttp;
    const token = isToken(current?.token) ? current.token : tokenFactory();
    if (!isToken(token)) throw new Error('MCP HTTP token generator returned an invalid token');
    const dockerAccess = current?.dockerAccess === true;
    const dockerPort = isDockerPort(current?.dockerPort)
      ? current.dockerPort : DEFAULT_MCP_DOCKER_PORT;
    if (
      token !== current?.token ||
      typeof current?.dockerAccess !== 'boolean' ||
      dockerPort !== current?.dockerPort
    ) {
      config.mcpHttp = { token, dockerAccess, dockerPort };
      io.write(config);
    }
    cached = { token, dockerAccess, dockerPort };
    return { ...cached };
  }

  function current(): McpHttpSettings {
    if (!cached) throw new Error('MCP HTTP settings are not initialized');
    return { ...cached };
  }

  function rotateToken(): McpHttpSettings {
    const active = ensure();
    const config = io.read();
    const token = tokenFactory();
    if (!isToken(token)) throw new Error('MCP HTTP token generator returned an invalid token');
    const next = { ...active, token };
    config.mcpHttp = next;
    io.write(config);
    cached = next;
    return { ...next };
  }

  function setDockerAccess(enabled: boolean): McpHttpSettings {
    const active = ensure();
    const config = io.read();
    const next = { ...active, dockerAccess: enabled };
    config.mcpHttp = next;
    io.write(config);
    cached = next;
    return { ...next };
  }

  function setDockerPort(port: number): McpHttpSettings {
    if (!isDockerPort(port)) throw new Error('Docker MCP port must be an integer from 1024 to 65535');
    const active = ensure();
    const config = io.read();
    const next = { ...active, dockerPort: port };
    config.mcpHttp = next;
    io.write(config);
    cached = next;
    return { ...next };
  }

  return { ensure, current, rotateToken, setDockerAccess, setDockerPort };
}

function isToken(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function isDockerPort(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1024 && Number(value) <= 65_535;
}

const legacyTokenFile = path.join(os.homedir(), '.stashbase', 'mcp-http-token');
const persistedStore = createMcpHttpSettingsStore(defaultIo, () => {
  try {
    const legacy = fs.readFileSync(legacyTokenFile, 'utf8').trim();
    if (isToken(legacy)) return legacy;
  } catch { /* no valid legacy token */ }
  return crypto.randomBytes(32).toString('hex');
});

function removeLegacyTokenFile(): void {
  try { fs.rmSync(legacyTokenFile, { force: true }); } catch { /* best effort migration cleanup */ }
}

let legacyCleanupDone = false;
function finishLegacyMigration<T>(operation: () => T): T {
  const result = operation();
  if (!legacyCleanupDone) {
    removeLegacyTokenFile();
    legacyCleanupDone = true;
  }
  return result;
}

export const mcpHttpSettings: McpHttpSettingsStore = {
  ensure: () => finishLegacyMigration(() => persistedStore.ensure()),
  current: () => persistedStore.current(),
  rotateToken: () => finishLegacyMigration(() => persistedStore.rotateToken()),
  setDockerAccess: (enabled) => finishLegacyMigration(() => persistedStore.setDockerAccess(enabled)),
  setDockerPort: (port) => finishLegacyMigration(() => persistedStore.setDockerPort(port)),
};
