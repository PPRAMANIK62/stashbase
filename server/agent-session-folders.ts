/**
 * Persisted native-session → member-folder overrides for Agent history.
 *
 * Both runtimes' native history stores key sessions by cwd. A library-scoped
 * chat runs with cwd = the folder home (the reserved library cwd), so when
 * `create_project` migrates such a chat to a newly created project, its
 * native history record still lives under the library cwd. This store is the
 * documented mapping override: it records "this native session now belongs
 * to that member folder". The history routes consult it — the library
 * listing excludes overridden sessions, the project listing includes them —
 * and Claude resume validation accepts an overridden session for its
 * override folder.
 *
 * App-owned durable state under AppData (rebuild loses only the mapping,
 * never a transcript: the native stores remain the transcript truth).
 */
import fs from 'node:fs';
import path from 'node:path';
import { appDataRoot } from './local-data.ts';
import { filesystemPath } from './filesystem-path.ts';
import { logger, errorMessage } from './log.ts';
import type { AttributedAgentId } from './agent-session-registry.ts';

const log = logger('agent-session-folders');

type OverrideFile = Partial<Record<AttributedAgentId, Record<string, string>>>;

function overridesPath(): string {
  return path.join(appDataRoot(), 'agent-session-folders.json');
}

function readFileState(): OverrideFile {
  try {
    const raw = fs.readFileSync(overridesPath(), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: OverrideFile = {};
    for (const agent of ['stashbase', 'claude', 'codex'] as const) {
      const value = (parsed as Record<string, unknown>)[agent];
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const map: Record<string, string> = {};
      for (const [id, folder] of Object.entries(value as Record<string, unknown>)) {
        if (typeof id === 'string' && id && typeof folder === 'string' && folder) map[id] = folder;
      }
      out[agent] = map;
    }
    return out;
  } catch {
    return {};
  }
}

function writeFileState(state: OverrideFile): void {
  const target = overridesPath();
  const tmp = `${target}.tmp`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, target);
}

/** Record that `sessionId`'s history now belongs to `folderAbs`. */
export function setAgentSessionFolderOverride(
  agent: AttributedAgentId,
  sessionId: string,
  folderAbs: string,
): void {
  if (!sessionId || !folderAbs) return;
  try {
    const state = readFileState();
    state[agent] = { ...(state[agent] ?? {}), [sessionId]: filesystemPath.absolute(folderAbs) };
    writeFileState(state);
  } catch (err: unknown) {
    log.warn(`could not persist session-folder override for ${agent}/${sessionId}: ${errorMessage(err)}`);
  }
}

export function clearAgentSessionFolderOverride(agent: AttributedAgentId, sessionId: string): void {
  if (!sessionId) return;
  try {
    const state = readFileState();
    const map = state[agent];
    if (!map || !(sessionId in map)) return;
    delete map[sessionId];
    writeFileState(state);
  } catch (err: unknown) {
    log.warn(`could not clear session-folder override for ${agent}/${sessionId}: ${errorMessage(err)}`);
  }
}

/** The override folder recorded for one native session id, or null. */
export function agentSessionFolderOverride(agent: AttributedAgentId, sessionId: string): string | null {
  if (!sessionId) return null;
  return readFileState()[agent]?.[sessionId] ?? null;
}

/** Snapshot of every override for one agent (session id → folder). */
export function agentSessionFolderOverrides(agent: AttributedAgentId): Record<string, string> {
  return { ...(readFileState()[agent] ?? {}) };
}

function pathsEqual(a: string, b: string): boolean {
  try {
    return filesystemPath.equal(a, b);
  } catch {
    return false;
  }
}

/** History-listing membership for one row under `folder`: an override wins
 * over the row's native cwd — an overridden session belongs ONLY to its
 * override folder (so the library listing under the folder-home cwd
 * excludes it), while a row without an override keeps its cwd identity. */
export function historyRowInFolder(
  overrideTarget: string | null | undefined,
  cwdMatchesFolder: boolean,
  folder: string,
): boolean {
  if (overrideTarget) return pathsEqual(overrideTarget, folder);
  return cwdMatchesFolder;
}

/** Filter native rows for `folder`: keep rows unless an override moves them
 * to another folder. (Rows are already cwd-scoped by the native store.) */
export function historyRowsForFolder<T extends { id: string }>(
  rows: readonly T[],
  overrides: Record<string, string>,
  folder: string,
): T[] {
  return rows.filter((row) => {
    const target = overrides[row.id];
    return !target || pathsEqual(target, folder);
  });
}

/** Overridden session ids that belong to `folder` but are missing from the
 * native cwd-scoped rows (they live under the reserved library cwd). */
export function missingOverriddenSessionIds(
  rows: readonly { id: string }[],
  overrides: Record<string, string>,
  folder: string,
): string[] {
  const present = new Set(rows.map((row) => row.id));
  return Object.entries(overrides)
    .filter(([id, target]) => pathsEqual(target, folder) && !present.has(id))
    .map(([id]) => id);
}
