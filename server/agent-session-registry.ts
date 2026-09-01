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

export type AttributedAgentId = 'stashbase' | 'claude' | 'codex';

/** The narrow live-session surface attributed host operations need. */
export interface AttributedAgentSession {
  readonly agentId: AttributedAgentId;
  /** The window that owns this panel session. */
  readonly windowId: string;
  /** Member folder the session is bound to; null for library-scoped. */
  boundFolder(): string | null;
  /** True while the session is library-wide (and not yet rebound). */
  isLibraryScoped(): boolean;
  /** True while the session is running a turn (a tool call from the agent
   * necessarily happens inside its own active turn). */
  turnInFlight(): boolean;
  /** Native session/thread id (history identity), when known. */
  nativeSessionId(): string | null;
  /** Whether this panel session may add vector similarity to
   * `search_library`. Lexical retrieval remains available either way. */
  similaritySearchEnabled(): boolean;
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

/** Last-resort attribution when NO identity reached the request at all —
 * some MCP hosts (Codex) spawn their MCP servers with a sanitized
 * environment, so neither the session nor the window id survives the
 * spawn chain. A tool call still happens inside its caller's turn, so
 * when exactly ONE registered session app-wide has a turn in flight, that
 * is the caller. Any ambiguity attributes to nobody: on a single-user
 * desktop two simultaneous turns are rare, and guessing wrong would
 * rebind someone else's chat. */
export function attributedTurnActiveSession(): AttributedAgentSession | null {
  const candidates: AttributedAgentSession[] = [];
  for (const session of sessions.values()) {
    if (session.turnInFlight()) candidates.push(session);
  }
  return candidates.length === 1 ? candidates[0] : null;
}

/** Resolve the calling panel session from strongest to weakest attribution.
 * Exact session ids win, then a window's sole active turn, then the app-wide
 * sole active turn for native clients that sanitize their MCP environment.
 * Ambiguity always resolves to no session, so external callers keep their
 * requested retrieval mode rather than inheriting another chat's switch. */
export function attributedRequestSession(
  sessionId: string | null | undefined,
  windowId: string | null | undefined,
): AttributedAgentSession | null {
  return attributedAgentSession(sessionId)
    ?? attributedSessionForWindow(windowId)
    ?? attributedTurnActiveSession();
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
