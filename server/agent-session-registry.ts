/**
 * Attribution registry for live built-in Agent panel sessions.
 *
 * Each panel session gets a private per-session attribution id at spawn.
 * The id travels through the session's process environment
 * (`STASHBASE_AGENT_SESSION_ID`) into the stdio MCP host, which forwards it
 * as the `x-stashbase-agent-session-id` request header — alongside the
 * existing window id. It is request identity only: it never resolves paths
 * and never grants extra access; it lets a host-side MCP tool
 * (`create_project`) find the LIVE session that made the call so the
 * session's scope binding can react (library-scoped chats rebind to a newly
 * created project; folder-bound chats never do).
 *
 * Kept dependency-free so the stdio MCP host can import the header name
 * without pulling server runtime modules.
 */

export const AGENT_SESSION_ID_HEADER = 'x-stashbase-agent-session-id';

export type AttributedAgentId = 'claude' | 'codex';

/** The narrow live-session surface `create_project` needs. */
export interface AttributedAgentSession {
  readonly agentId: AttributedAgentId;
  /** Member folder the session is bound to; null for library-scoped. */
  boundFolder(): string | null;
  /** True while the session is library-wide (and not yet rebound). */
  isLibraryScoped(): boolean;
  /** Native session/thread id (history identity), when known. */
  nativeSessionId(): string | null;
  /** Migrate a library-scoped session's binding to a member folder and
   * notify its renderer (`scope-changed`). Returns false when the session
   * is closed or already folder-bound — a bound chat is NEVER rebound. */
  rebindToFolder(folderAbs: string): boolean;
}

const sessions = new Map<string, AttributedAgentSession>();

export function registerAttributedAgentSession(id: string, session: AttributedAgentSession): void {
  if (id) sessions.set(id, session);
}

export function unregisterAttributedAgentSession(id: string): void {
  sessions.delete(id);
}

export function attributedAgentSession(id: string | null | undefined): AttributedAgentSession | null {
  if (typeof id !== 'string' || !id.trim()) return null;
  return sessions.get(id.trim()) ?? null;
}

export type CreateProjectRebindPlan =
  | { kind: 'none'; reason: 'no-session' }
  | { kind: 'none'; reason: 'folder-bound'; folder: string }
  | { kind: 'rebind' };

/** The rebind decision for a `create_project` call: only a LIVE,
 * library-scoped calling session migrates its binding. A folder-bound chat
 * keeps its folder, and a call without session attribution (external MCP
 * clients) only creates + registers. */
export function createProjectRebindPlan(
  session: Pick<AttributedAgentSession, 'boundFolder' | 'isLibraryScoped'> | null,
): CreateProjectRebindPlan {
  if (!session) return { kind: 'none', reason: 'no-session' };
  const bound = session.boundFolder();
  if (bound != null) return { kind: 'none', reason: 'folder-bound', folder: bound };
  if (!session.isLibraryScoped()) return { kind: 'none', reason: 'no-session' };
  return { kind: 'rebind' };
}
