/**
 * Attribution registry for live Agent Panel sessions.
 *
 * Each panel session gets a private per-session attribution id at spawn.
 * The id travels through the session's process environment
 * (`STASHBASE_AGENT_SESSION_ID`) into the stdio MCP host, which forwards it
 * as the `x-stashbase-agent-session-id` request header — alongside the
 * existing window id. It is request identity only: it never resolves paths
 * and never grants extra access; it lets a host-side MCP tool
 * (`create_project`) find the LIVE session that made the call so the
 * session's scope binding can react (unbound chats rebind to a newly
 * created project; folder-bound chats never do).
 *
 * Kept dependency-free so the stdio MCP host can import the header name
 * without pulling server runtime modules.
 */

export const AGENT_SESSION_ID_HEADER = 'x-stashbase-agent-session-id';

export type AttributedAgentId = 'stashbase' | 'claude' | 'codex';

/** The narrow live-session surface attributed host operations need. */
export interface AttributedAgentSession {
  readonly agentId: AttributedAgentId;
  /** The window that owns this panel session. */
  readonly windowId: string;
  /** Member folder the session is bound to; null for unbound. */
  boundFolder(): string | null;
  /** True while the session is unbound (and not yet rebound). */
  isUnbound(): boolean;
  /** True while the session is running a turn (a tool call from the agent
   * necessarily happens inside its own active turn). */
  turnInFlight(): boolean;
  /** Native session/thread id (history identity), when known. */
  nativeSessionId(): string | null;
  /** Migrate an unbound session's binding to a member folder and
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

/** Window-scoped attribution fallback for MCP hosts that predate the
 * session-id header (an installed `stashbase-mcp` binary keeps forwarding
 * only the window id). A tool call happens inside the calling session's
 * active turn, so "the one session of this window currently running a
 * turn" identifies the caller precisely; any ambiguity (zero or several
 * candidates) attributes to nobody rather than guessing. */
export function attributedSessionForWindow(
  windowId: string | null | undefined,
): AttributedAgentSession | null {
  if (typeof windowId !== 'string' || !windowId.trim()) return null;
  const id = windowId.trim();
  const candidates: AttributedAgentSession[] = [];
  for (const session of sessions.values()) {
    if (session.windowId === id && session.turnInFlight()) candidates.push(session);
  }
  return candidates.length === 1 ? candidates[0] : null;
}

/** Supplied session identity is authoritative, including when stale or blank.
 * Only its absence permits a window's sole active turn to identify the caller.
 * Never infer request ownership from activity elsewhere in the app. */
export function attributedRequestSession(
  sessionId: string | null | undefined,
  windowId: string | null | undefined,
): AttributedAgentSession | null {
  return sessionId != null
    ? attributedAgentSession(sessionId)
    : attributedSessionForWindow(windowId);
}

export type CreateProjectRebindPlan =
  | { kind: 'none'; reason: 'no-session' }
  | { kind: 'none'; reason: 'folder-bound'; folder: string }
  | { kind: 'rebind' };

/** The rebind decision for a `create_project` call: only a LIVE,
 * unbound calling session migrates its binding. A folder-bound chat
 * keeps its folder, and a call without session attribution (external MCP
 * clients) only creates + registers. */
export function createProjectRebindPlan(
  session: Pick<AttributedAgentSession, 'boundFolder' | 'isUnbound'> | null,
): CreateProjectRebindPlan {
  if (!session) return { kind: 'none', reason: 'no-session' };
  const bound = session.boundFolder();
  if (bound != null) return { kind: 'none', reason: 'folder-bound', folder: bound };
  if (!session.isUnbound()) return { kind: 'none', reason: 'no-session' };
  return { kind: 'rebind' };
}
