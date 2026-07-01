import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface AgentCliSpec {
  name: string;
  envNames: string[];
  logLabel: string;
}

const CLI_SEARCH_DIRS = [
  path.join(os.homedir(), '.npm-global', 'bin'),
  path.join(os.homedir(), '.local', 'bin'),
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
];

function isExecutable(file: string): boolean {
  try {
    fs.accessSync(file, fs.constants.X_OK);
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

export function agentCliPath(extraDirs: string[] = [], basePath = process.env.PATH ?? ''): string {
  return unique([
    ...extraDirs,
    ...CLI_SEARCH_DIRS,
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

export function resolveAgentCli(spec: AgentCliSpec, warn?: (message: string) => void): string | null {
  const explicit = spec.envNames
    .map((name) => process.env[name])
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  for (const candidate of explicit) {
    const resolved = path.resolve(expandHome(candidate));
    if (isExecutable(resolved)) return resolved;
    warn?.(`${spec.logLabel} binary override is not executable: ${candidate}`);
  }

  for (const dir of agentCliPath().split(path.delimiter)) {
    const candidate = path.join(dir, spec.name);
    if (isExecutable(candidate)) return candidate;
  }

  return null;
}
