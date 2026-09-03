/**
 * StashBase MCP launcher and Agent Panel runtime MCP configuration.
 *
 * Owns the platform launcher script under `~/.stashbase/bin`, the
 * per-process launcher used by Wiki Agent, and idempotent config writes
 * for the bring-your-own Chat runtimes (Claude Code, Codex). Only Agent
 * readiness calls `ensureAgentMcp`; every other
 * MCP-compatible client configures itself from the standard config that
 * Settings → MCP exposes read-only.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const APP_ROOT = process.env.STASHBASE_APP_ROOT
  ? path.resolve(process.env.STASHBASE_APP_ROOT)
  : path.resolve(process.cwd());

const MCP_ENTRY = fs.existsSync(path.join(APP_ROOT, 'dist', 'mcp', 'server.mjs'))
  ? path.join(APP_ROOT, 'dist', 'mcp', 'server.mjs')
  : path.join(APP_ROOT, 'mcp', 'server.ts');

/** Regenerate the launcher when the MCP entry is available, so the config
 * handed out to copy actually works when pasted; otherwise report the
 * expected path without writing. */
export function ensureMcpLauncher(homeDir = os.homedir()): string {
  return fs.existsSync(MCP_ENTRY) ? writeMcpWrapper(homeDir) : currentMcpWrapper(homeDir);
}

export function standardMcpJson(wrapper: string): Record<string, unknown> {
  return {
    mcpServers: {
      stashbase: {
        command: wrapper,
      },
    },
  };
}

/** Idempotently wire the given built-in Chat runtime to StashBase MCP:
 * regenerate the launcher, then rewrite the stashbase entry in that agent's
 * own config file. Third-party clients are never written here — they get the
 * standard config to paste. */
export function ensureAgentMcp(id: 'claude' | 'codex'): void {
  if (!fs.existsSync(MCP_ENTRY)) {
    throw new Error(`MCP entry missing: ${MCP_ENTRY}`);
  }
  const wrapper = writeMcpWrapper();
  if (id === 'codex') {
    configureCodex(path.join(os.homedir(), '.codex', 'config.toml'), wrapper);
  } else {
    configureJsonMcp(path.join(os.homedir(), '.claude.json'), { type: 'stdio', command: wrapper });
  }
}

function currentMcpWrapper(homeDir = os.homedir()): string {
  return path.join(
    homeDir,
    '.stashbase',
    'bin',
    process.platform === 'win32' ? 'stashbase-mcp.cmd' : 'stashbase-mcp',
  );
}

function shellQuote(value: string): string {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function cmdQuote(value: string): string {
  return `"${cmdValue(value).replace(/"/g, '""')}"`;
}

function cmdValue(value: string): string {
  return String(value).replace(/%/g, '%%');
}

function localBin(name: string): string {
  return path.join(APP_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name);
}

function writeMcpWrapper(homeDir = os.homedir()): string {
  const binDir = path.join(homeDir, '.stashbase', 'bin');
  const wrapper = currentMcpWrapper(homeDir);
  const resourcesPath = process.env.STASHBASE_RESOURCES_PATH || APP_ROOT;
  const isBuilt = MCP_ENTRY.endsWith(path.join('dist', 'mcp', 'server.mjs'));
  const content = process.platform === 'win32'
    ? [
        '@echo off',
        `set "STASHBASE_APP_ROOT=${cmdValue(APP_ROOT)}"`,
        `set "STASHBASE_RESOURCES_PATH=${cmdValue(resourcesPath)}"`,
        ...(isBuilt
          ? [
              'set "ELECTRON_RUN_AS_NODE=1"',
              `${cmdQuote(process.execPath)} ${cmdQuote(MCP_ENTRY)} %*`,
            ]
          : [
              `${cmdQuote(localBin('tsx'))} ${cmdQuote(MCP_ENTRY)} %*`,
            ]),
        '',
      ].join('\r\n')
    : [
        '#!/bin/sh',
        'set -eu',
        `export STASHBASE_APP_ROOT=${shellQuote(APP_ROOT)}`,
        `export STASHBASE_RESOURCES_PATH=${shellQuote(resourcesPath)}`,
        ...(isBuilt
          ? [
              'export ELECTRON_RUN_AS_NODE=1',
              `exec ${shellQuote(process.execPath)} ${shellQuote(MCP_ENTRY)} "$@"`,
            ]
          : [
              `exec ${shellQuote(localBin('tsx'))} ${shellQuote(MCP_ENTRY)} "$@"`,
            ]),
        '',
      ].join('\n');
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(wrapper, content, { mode: 0o755 });
  try { fs.chmodSync(wrapper, 0o755); } catch { /* best-effort on Windows/special filesystems */ }
  return wrapper;
}

function readJsonObject(file: string): Record<string, unknown> | null {
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function writeJson(file: string, value: unknown): void {
  writeTextAtomic(file, JSON.stringify(value, null, 2) + '\n');
}

function configureJsonMcp(file: string, serverConfig: Record<string, unknown>): void {
  const config = readJsonObject(file);
  if (!config) throw new Error(`Couldn't parse ${file}; leaving it untouched.`);
  const currentServers =
    config.mcpServers && typeof config.mcpServers === 'object' && !Array.isArray(config.mcpServers)
      ? config.mcpServers as Record<string, unknown>
      : {};
  config.mcpServers = {
    ...currentServers,
    stashbase: serverConfig,
  };
  writeJson(file, config);
}

function replaceTomlTable(raw: string, tableName: string, block: string): string {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  const headerRe = /^\s*\[([^\]]+)\]\s*$/;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(headerRe);
    if (!match || match[1] !== tableName) {
      out.push(lines[i]);
      continue;
    }
    i += 1;
    while (i < lines.length) {
      const nextMatch = lines[i].match(headerRe);
      if (nextMatch && nextMatch[1] !== tableName && !nextMatch[1].startsWith(`${tableName}.`)) {
        break;
      }
      i += 1;
    }
    i -= 1;
  }
  const trimmed = out.join('\n').trimEnd();
  return `${trimmed ? `${trimmed}\n\n` : ''}${block}\n`;
}

function configureCodex(file: string, wrapper: string): void {
  const raw = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const block = [
    '[mcp_servers.stashbase]',
    `command = ${JSON.stringify(wrapper)}`,
    'default_tools_approval_mode = "prompt"',
    '',
    ...CODEX_AUTO_APPROVED_STASHBASE_TOOLS.flatMap((tool) => [
      `[mcp_servers.stashbase.tools.${tool}]`,
      'approval_mode = "approve"',
      '',
    ]),
  ].join('\n');
  writeTextAtomic(file, replaceTomlTable(raw, 'mcp_servers.stashbase', block));
}

const CODEX_AUTO_APPROVED_STASHBASE_TOOLS = [
  'library_info',
  'list_directory',
  'read_file',
  'reindex',
  'search_library',
];

function writeTextAtomic(file: string, content: string): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tmp, content, { encoding: 'utf8' });
    fs.renameSync(tmp, file);
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ }
    throw err;
  }
}
