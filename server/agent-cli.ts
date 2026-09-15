import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { probeAgentCommand } from './agent-probe.ts';
export interface AgentCliSpec {
  name: string;
  envNames: string[];
  logLabel: string;
}

const WINDOWS_EXECUTABLE_EXTENSIONS = new Set(['.com', '.exe', '.cmd', '.bat']);
const LOGIN_SHELL_MISS_CACHE_MS = 10_000;
const loginShellCache = new Map<string, { checkedAt: number; executable: string | null }>();

export function isWindowsLaunchableAgentCliPath(file: string): boolean {
  return WINDOWS_EXECUTABLE_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function isExecutable(file: string): boolean {
  try {
    fs.accessSync(file, process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK);
    if (process.platform === 'win32') {
      return fs.statSync(file).isFile() && isWindowsLaunchableAgentCliPath(file);
    }
    return true;
  } catch {
    return false;
  }
}

function expandHome(candidate: string): string {
  if (candidate === '~') return os.homedir();
  if (candidate.startsWith('~/')) return path.join(os.homedir(), candidate.slice(2));
  return candidate;
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter((item) => item.trim().length > 0))];
}

function environmentValue(env: NodeJS.ProcessEnv, name: string): string {
  const key = Object.keys(env).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  const value = key ? env[key] : undefined;
  return typeof value === 'string' ? value : '';
}

export function agentCliSearchDirs(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): string[] {
  const join = platform === 'win32' ? path.win32.join : path.posix.join;
  const dirs = [
    join(home, '.npm-global', 'bin'),
    join(home, '.local', 'bin'),
  ];
  if (platform === 'win32') {
    const appData = environmentValue(env, 'APPDATA');
    const localAppData = environmentValue(env, 'LOCALAPPDATA');
    return unique([
      ...dirs,
      appData ? join(appData, 'npm') : '',
      localAppData ? join(localAppData, 'npm') : '',
      localAppData ? join(localAppData, 'Programs', 'OpenAI', 'Codex', 'bin') : '',
    ]);
  }
  return unique([...dirs, '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']);
}

export function agentCliPath(extraDirs: string[] = [], basePath = process.env.PATH ?? ''): string {
  return unique([
    ...extraDirs,
    ...agentCliSearchDirs(),
    ...basePath.split(path.delimiter),
  ]).join(path.delimiter);
}

export function agentCliEnv(extraEnv: NodeJS.ProcessEnv = {}, extraDirs: string[] = []): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...extraEnv,
    PATH: agentCliPath(extraDirs, extraEnv.PATH ?? process.env.PATH ?? ''),
    ELECTRON_RUN_AS_NODE: undefined,
  } as NodeJS.ProcessEnv;
}

export function agentCliExecutableCandidates(name: string, platform: NodeJS.Platform = process.platform): string[] {
  if (platform !== 'win32') return [name];
  const ext = path.extname(name);
  if (ext) return [name];
  return [`${name}.exe`, `${name}.cmd`, `${name}.bat`, `${name}.com`, name];
}

function resolveSystemAgentCli(
  spec: AgentCliSpec,
  warn?: (message: string) => void,
): string | null {
  const explicit = spec.envNames
    .map((name) => process.env[name])
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  for (const candidate of explicit) {
    const resolved = path.resolve(expandHome(candidate));
    if (isExecutable(resolved)) return resolved;
    warn?.(`${spec.logLabel} binary override is not executable: ${candidate}`);
  }

  for (const dir of agentCliPath().split(path.delimiter)) {
    for (const name of agentCliExecutableCandidates(spec.name)) {
      const candidate = path.join(dir, name);
      if (isExecutable(candidate)) return candidate;
    }
  }

  const cached = loginShellCache.get(spec.name);
  if (cached?.executable && isExecutable(cached.executable)) return cached.executable;

  return null;
}

export function resolveAgentCli(spec: AgentCliSpec, warn?: (message: string) => void): string | null {
  return resolveSystemAgentCli(spec, warn);
}

/** Readiness can discover version-manager installations without blocking HTTP. */
export async function resolveAgentCliWithLoginShell(
  spec: AgentCliSpec,
  warn?: (message: string) => void,
  signal?: AbortSignal,
): Promise<string | null> {
  signal?.throwIfAborted();
  const system = resolveSystemAgentCli(spec, warn);
  const cached = loginShellCache.get(spec.name);
  const recentMiss = cached?.executable === null && Date.now() - cached.checkedAt < LOGIN_SHELL_MISS_CACHE_MS;
  if (!system && !recentMiss
      && process.platform !== 'win32' && /^[A-Za-z0-9_-]+$/.test(spec.name)) {
    let executable: string | null = null;
    try {
      const result = await probeAgentCommand(
        process.env.SHELL || '/bin/zsh', ['-l', '-i', '-c', `command -v ${spec.name}`],
        { env: agentCliEnv(), timeoutMs: 5_000, signal },
      );
      if (result.status === 0) {
        const candidate = result.stdout.trim().split(/\r?\n/).at(-1);
        if (candidate) {
          const resolved = path.resolve(expandHome(candidate));
          if (isExecutable(resolved)) executable = resolved;
        }
      }
    } catch {
      signal?.throwIfAborted();
      // A broken shell profile leaves normal runtime discovery available.
    }
    loginShellCache.set(spec.name, { checkedAt: Date.now(), executable });
  }
  return resolveAgentCli(spec, warn);
}

export function agentCliNeedsShell(command: string): boolean {
  return process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
}

export function commandDir(command: string): string {
  return command.includes('/') || command.includes('\\') ? path.dirname(command) : '';
}
