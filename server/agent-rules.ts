import fs from 'node:fs';
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
