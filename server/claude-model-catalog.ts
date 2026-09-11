/** Claude's model catalog, read at the runtime level.
 *
 * A bare SDK handshake is enough for the catalog: the CLI starts, answers
 * `initialize` with the models it offers, and is closed before any turn, so
 * nothing is spent and no session is written. The handshake names no default,
 * because Claude keeps the model and effort a user chose in its own user
 * settings rather than in the catalog; those are read from the same
 * `settings.json` the CLI reads, and the catalog's own "Default (recommended)"
 * entry stands in when no model is set. A session still reports the model it
 * actually runs on its first turn, which is what the memory prefers. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AgentModel } from '../shared/agent-protocol.ts';
import { agentCliEnv, commandDir, resolveAgentCli } from './agent-cli.ts';

/** The two persisted choices this read cares about; everything else in the
 * file is the CLI's own business. */
export interface ClaudeUserSettings {
  model?: string;
  effortLevel?: string;
}

/** What the SDK handshake says about one model. Named here rather than
 * imported so a fake handshake in a test needs no SDK type. */
interface ClaudeCatalogEntry {
  value: string;
  displayName: string;
  description?: string;
  supportedEffortLevels?: string[];
}

export interface ClaudeCatalogReading {
  models: AgentModel[];
  defaultModel?: string;
}

export function claudeSettingsPath(): string {
  return path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'settings.json');
}

/** Reads the user-scope settings defensively: a missing or malformed file is
 * the same as one that chooses nothing. */
export function readClaudeUserSettings(file = claudeSettingsPath()): ClaudeUserSettings {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    return {
      ...(typeof parsed.model === 'string' && parsed.model ? { model: parsed.model } : {}),
      ...(typeof parsed.effortLevel === 'string' && parsed.effortLevel ? { effortLevel: parsed.effortLevel } : {}),
    };
  } catch {
    return {};
  }
}

/** The handshake's entries in the shared shape. The persisted effort is a
 * session-wide choice in Claude, so it becomes the default effort of every
 * model that can run at it. */
function claudeCatalogModels(entries: ClaudeCatalogEntry[], settings: ClaudeUserSettings): AgentModel[] {
  return entries.map((entry) => {
    const supportedEfforts = entry.supportedEffortLevels;
    const effort = settings.effortLevel;
    return {
      id: entry.value,
      label: entry.displayName || entry.value,
      ...(entry.description ? { description: entry.description } : {}),
      ...(supportedEfforts?.length ? { supportedEfforts } : {}),
      ...(effort && supportedEfforts?.includes(effort) ? { defaultEffort: effort } : {}),
    };
  });
}

/** The model the CLI would run with nothing chosen in a chat: the one the
 * user's settings name when the catalog lists it, else the catalog's own
 * `default` entry, else nothing. */
function claudeDefaultModel(models: AgentModel[], settings: ClaudeUserSettings): string | undefined {
  if (settings.model && models.some((model) => model.id === settings.model)) return settings.model;
  return models.some((model) => model.id === 'default') ? 'default' : undefined;
}

/** The whole reading: the catalog with the default flagged the way Codex
 * flags its own, so a chat and the runtime listing describe Claude alike
 * whichever of them read it. */
export function claudeCatalog(entries: ClaudeCatalogEntry[], settings: ClaudeUserSettings): ClaudeCatalogReading {
  const models = claudeCatalogModels(entries, settings);
  const defaultModel = claudeDefaultModel(models, settings);
  if (!defaultModel) return { models };
  return {
    models: models.map((model) => (model.id === defaultModel ? { ...model, isDefault: true } : model)),
    defaultModel,
  };
}

function resolveClaudeExecutable(): string | null {
  return resolveAgentCli({
    name: 'claude',
    envNames: ['STASHBASE_CLAUDE_BIN', 'CLAUDE_CODE_BIN'],
    logLabel: 'Claude Code',
  });
}

export async function readClaudeModelCatalog(options: {
  createQuery?: typeof query;
  readSettings?: () => ClaudeUserSettings;
  executable?: () => string | null;
  timeoutMs?: number;
} = {}): Promise<ClaudeCatalogReading> {
  const executable = (options.executable ?? resolveClaudeExecutable)();
  if (!executable) throw new Error('Claude CLI not found.');
  // A prompt stream that never yields: the CLI initializes, and no turn begins.
  const idle = (async function* () {
    await new Promise<never>(() => undefined);
  })();
  const q = (options.createQuery ?? query)({
    prompt: idle,
    options: {
      cwd: os.homedir(),
      env: agentCliEnv({}, [commandDir(executable)]) as Record<string, string>,
      mcpServers: {},
      pathToClaudeCodeExecutable: executable,
      settingSources: ['user'],
      strictMcpConfig: true,
      tools: [],
    },
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Claude CLI did not answer its initialize handshake.')), options.timeoutMs ?? 15_000);
    timer.unref?.();
  });
  try {
    const init = await Promise.race([q.initializationResult(), timeout]);
    return claudeCatalog(init.models, (options.readSettings ?? readClaudeUserSettings)());
  } finally {
    if (timer) clearTimeout(timer);
    q.close();
  }
}
