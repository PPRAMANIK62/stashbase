import fs from 'node:fs';
import path from 'node:path';
import type {
  AgentPersonaChoice,
  AgentPersonaPreset,
  AgentPersonaScope,
  AgentPersonaState,
} from '../shared/agent-persona.ts';
import {
  AGENT_PERSONA_PRESETS,
  isAgentPersonaChoice,
  MAX_AGENT_PERSONA_LENGTH,
} from '../shared/agent-persona.ts';
import {
  readAppConfig,
  readAppConfigStrict,
  writeAppConfigStrict,
  type AppConfigFile,
} from './app-config.ts';
import { filesystemPath } from './filesystem-path.ts';

interface StoredFolderPersona {
  path: string;
  selected?: AgentPersonaChoice;
  custom?: string;
}

export interface AgentPersonaChange {
  selected?: AgentPersonaChoice | null;
  custom?: string;
}

export interface AgentPersonaStore {
  get(scope: AgentPersonaScope): AgentPersonaState;
  set(scope: AgentPersonaScope, change: AgentPersonaChange): AgentPersonaState;
  /** The prompt a session in this project starts with; empty when none. */
  resolve(folderPath: string): string;
}

const RESOURCES_ROOT = process.env.STASHBASE_RESOURCES_PATH
  ? path.resolve(process.env.STASHBASE_RESOURCES_PATH)
  : process.env.STASHBASE_APP_ROOT
    ? path.resolve(process.env.STASHBASE_APP_ROOT)
    : path.resolve(import.meta.dirname, '..');

/** Each packaged persona is product content, not runtime routing policy.
 * Keeping each as one Markdown resource lets product changes edit the exact
 * bytes a session receives. Runtime Adapters preserve those bytes when
 * composing their separate internal policy. */
export function readAgentPersonaPresets(
  directory = path.join(RESOURCES_ROOT, 'assets', 'agent-personas'),
): Record<AgentPersonaPreset, string> {
  const entries = AGENT_PERSONA_PRESETS.map((id) => {
    const file = path.join(directory, `${id}.md`);
    const text = fs.readFileSync(file, 'utf8').trim();
    if (!text) throw new Error(`Packaged persona is empty: ${file}`);
    if (text.length > MAX_AGENT_PERSONA_LENGTH) {
      throw new Error(`Packaged persona exceeds ${MAX_AGENT_PERSONA_LENGTH.toLocaleString('en-US')} characters: ${file}`);
    }
    return [id, text] as const;
  });
  return Object.fromEntries(entries) as Record<AgentPersonaPreset, string>;
}

function readableText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.slice(0, MAX_AGENT_PERSONA_LENGTH).trim();
}

function inputError(message: string): Error {
  const error = new Error(message) as Error & { code: string; status: number };
  error.code = 'INVALID_AGENT_PERSONA';
  error.status = 400;
  return error;
}

function normalizedCustom(value: unknown): string {
  if (typeof value !== 'string') throw inputError('custom must be a string');
  if (value.length > MAX_AGENT_PERSONA_LENGTH) {
    throw inputError(`A persona must be ${MAX_AGENT_PERSONA_LENGTH.toLocaleString('en-US')} characters or fewer`);
  }
  return value.trim();
}

function storedFolders(config: AppConfigFile): StoredFolderPersona[] {
  const value: unknown = config.agentPersonas;
  const folders = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as { folders?: unknown }).folders
    : undefined;
  if (!Array.isArray(folders)) return [];
  return folders.filter((entry): entry is StoredFolderPersona => (
    !!entry
    && typeof entry === 'object'
    && typeof entry.path === 'string'
    && !!entry.path.trim()
  ));
}

/** A hand-edited or damaged entry reads as the nearest valid state: an unknown
 * persona, or Custom without a prompt, runs none. */
function stateOf(scope: AgentPersonaScope, entry: StoredFolderPersona | undefined): AgentPersonaState {
  const custom = readableText(entry?.custom);
  const selected = isAgentPersonaChoice(entry?.selected) && (entry.selected !== 'custom' || custom)
    ? entry.selected
    : null;
  return { scope, selected, custom };
}

/** One deep interface owns scope matching, defensive reads, validation, and
 * config compaction. Callers never manipulate the persisted shape directly. */
export function createAgentPersonaStore(io: {
  read(): AppConfigFile;
  readStrict(): AppConfigFile;
  write(config: AppConfigFile): void;
  equalPath(left: string, right: string): boolean;
  presets: Record<AgentPersonaPreset, string>;
}): AgentPersonaStore {
  const pathsEqual = (left: string, right: string): boolean => {
    try { return io.equalPath(left, right); }
    catch { return false; }
  };

  function get(scope: AgentPersonaScope): AgentPersonaState {
    return stateOf(scope, storedFolders(io.read()).find((entry) => pathsEqual(entry.path, scope.path)));
  }

  function set(scope: AgentPersonaScope, change: AgentPersonaChange): AgentPersonaState {
    if (change.selected !== undefined && change.selected !== null && !isAgentPersonaChoice(change.selected)) {
      throw inputError('selected must name a persona');
    }
    const config = io.readStrict();
    const folders = storedFolders(config);
    const previous = stateOf(scope, folders.find((entry) => pathsEqual(entry.path, scope.path)));
    const custom = change.custom === undefined ? previous.custom : normalizedCustom(change.custom);
    let selected = change.selected === undefined ? previous.selected : change.selected;
    if (selected === 'custom' && !custom) {
      // Clearing the prompt while it is chosen leaves no persona to run.
      if (change.selected === 'custom') throw inputError('Write a custom persona before choosing it');
      selected = null;
    }

    const retained = folders.filter((entry) => !pathsEqual(entry.path, scope.path));
    if (selected || custom) {
      retained.push({ path: scope.path, ...(selected ? { selected } : {}), ...(custom ? { custom } : {}) });
    }
    if (retained.length) config.agentPersonas = { folders: retained };
    else delete config.agentPersonas;
    io.write(config);
    return { scope, selected, custom };
  }

  function resolve(folderPath: string): string {
    const { selected, custom } = get({ kind: 'folder', path: folderPath });
    if (selected === null) return '';
    return selected === 'custom' ? custom : io.presets[selected];
  }

  return { get, set, resolve };
}

const store = createAgentPersonaStore({
  // Reads used while starting an Agent fail soft, matching other optional
  // preferences: a damaged config must not prevent Chat from opening.
  read: readAppConfig,
  // Writes fail closed so Save never replaces malformed config with defaults.
  readStrict: readAppConfigStrict,
  write: writeAppConfigStrict,
  equalPath: filesystemPath.equal,
  presets: readAgentPersonaPresets(),
});

export function getAgentPersona(scope: AgentPersonaScope): AgentPersonaState {
  return store.get(scope);
}

export function setAgentPersona(scope: AgentPersonaScope, change: AgentPersonaChange): AgentPersonaState {
  return store.set(scope, change);
}

/** Runtime-facing read for the session's fixed project. */
export function resolveAgentPersona(folderPath: string): string {
  return store.resolve(folderPath);
}
