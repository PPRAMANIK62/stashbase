/** Live-session attribution for project operations. The private session id
 * travels through the native process and MCP host; it selects the calling
 * conversation's project without granting additional file access. */

export const AGENT_SESSION_ID_HEADER = 'x-stashbase-agent-session-id';

export type AttributedAgentId = 'stashbase' | 'claude' | 'codex';

/** The narrow live-session surface attributed host operations need. */
export interface AttributedAgentSession {
  readonly agentId: AttributedAgentId;
  /** The window that owns this panel session. */
  readonly windowId: string;
  /** Member folder the session is bound to; null before startup or after retirement. */
  boundFolder(): string | null;
  /** True while the session is running a turn (a tool call from the agent
   * necessarily happens inside its own active turn). */
  turnInFlight(): boolean;
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
