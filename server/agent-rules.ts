import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { logger, errorMessage } from './log.ts';

const log = logger('agent-rules');

export const AGENTS_FILE = 'AGENTS.md';
export const CLAUDE_FILE = 'CLAUDE.md';

const AGENTS_TEMPLATE = `# Agent Instructions

You are working inside this folder as a long-running collaborator, not a one-off assistant.

First, understand the workspace:
- What this folder is for
- What kind of work the user does here
- What role the user expects you to play
- What tone, level of detail, and working style fits this folder

Be proactive:
- Read the relevant local files before answering
- Point out inconsistencies, missing context, or better next steps
- When the user asks for a change, make the change instead of only proposing it
- Keep the work grounded in the files in this folder

Treat local files as the source of truth. If something is unclear, inspect the folder first.

Keep this file short. Update it only for durable workspace instructions, user preferences, or role expectations that should shape future sessions. Do not use it as a chat log or task history.
`;

const CLAUDE_BRIDGE_TEMPLATE = `@${AGENTS_FILE}
`;

export function ensureAgentsFile(folderRoot: string): boolean {
  return writeOnce(path.join(folderRoot, AGENTS_FILE), AGENTS_TEMPLATE);
}

export function ensureClaudeBridgeFile(folderRoot: string): boolean {
  ensureAgentsFile(folderRoot);
  return writeOnce(path.join(folderRoot, CLAUDE_FILE), CLAUDE_BRIDGE_TEMPLATE);
}

/** Claude gates each session cwd behind its folder-trust dialog. A
 *  headless SDK session can never show that dialog — it just hangs at
 *  "working" until the user runs `claude` in a terminal and accepts —
 *  and Claude Code offers no trust flag or env override (the only
 *  narrow mechanism is the per-project `hasTrustDialogAccepted` flag in
 *  `~/.claude.json`). Adding a folder to the StashBase library is the
 *  user's explicit trust act, so pre-accept trust for the session
 *  folder before connecting.
 *
 *  Conservative merge: only this one project's flag is touched, every
 *  other key is preserved, and an unreadable or malformed config is
 *  left alone (the CLI owns that file). */
export function ensureClaudeFolderTrust(
  folderRoot: string,
  configFile = path.join(os.homedir(), '.claude.json'),
): void {
  try {
    let config: Record<string, unknown> = {};
    if (fs.existsSync(configFile)) {
      const parsed: unknown = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      config = parsed as Record<string, unknown>;
    }
    const projects = asRecord(config.projects) ?? {};
    const entry = asRecord(projects[folderRoot]) ?? {};
    if (entry.hasTrustDialogAccepted === true) return;
    projects[folderRoot] = { ...entry, hasTrustDialogAccepted: true };
    config.projects = projects;
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  } catch (err: unknown) {
    // Never block the session on this — worst case the user trusts the
    // folder once in a terminal, which is exactly today's behaviour.
    log.warn(`could not pre-trust ${folderRoot} for Claude: ${errorMessage(err)}`);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function writeOnce(absPath: string, content: string): boolean {
  try {
    fs.writeFileSync(absPath, content, { encoding: 'utf8', flag: 'wx' });
    return true;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'EEXIST') return false;
    log.warn(`failed to create ${path.basename(absPath)}: ${errorMessage(err)}`);
    return false;
  }
}
