/** How a Template card reaches the Chat that will run it. Mirrors
 * `agentInstructionsTrigger`: the gallery announces, and mounted sessions
 * decide for themselves whether the preset is theirs.
 *
 * Broadcast + latch, not a callback: the gallery lives in the main pane
 * while the session hook lives in the chat panel, and the chat tab the
 * request lands on may not be MOUNTED yet — `activateChatTab` can create
 * it (or re-agent a reused blank tab, remounting its view) in the same
 * tick. The latch survives until the right session consumes it, so both
 * orders work; consuming clears it, which is what makes double-delivery
 * impossible.
 *
 * The latch names the AGENT it was requested for, and consumption is
 * agent-gated: without that, the outgoing view of a reused blank tab
 * (still mounted and active while React commits the agent switch) hears
 * the broadcast first, arms the intent, and takes it down with itself on
 * remount — the exact race observed with a stashbase-gated blank tab
 * switching to Codex. */
import type { AgentKind } from '@/common/lib/agentCatalog';

const TEMPLATE_REQUESTED_EVENT = 'stashbase-template-requested';

let pending: { prompt: string; agent: AgentKind } | null = null;

/** Latch the template's visible preset prompt for one agent, and announce. */
export function requestTemplate(prompt: string, agent: AgentKind): void {
  pending = { prompt, agent };
  window.dispatchEvent(new Event(TEMPLATE_REQUESTED_EVENT));
}

/** Take the latched prompt if it was requested for this agent, clearing it.
 *  A mismatched caller leaves the latch for the session it belongs to. */
export function consumePendingTemplate(agent: AgentKind): string | null {
  if (!pending || pending.agent !== agent) return null;
  const { prompt } = pending;
  pending = null;
  return prompt;
}

/** Subscribe a mounted session. Returns its own unsubscribe. Handlers
 *  consume via `consumePendingTemplate(agent)` rather than event payload —
 *  the latch is the single source, so a session that hears the event after
 *  another consumed it (or that is not the latch's agent) finds nothing. */
export function onTemplateRequested(handler: () => void): () => void {
  window.addEventListener(TEMPLATE_REQUESTED_EVENT, handler);
  return () => window.removeEventListener(TEMPLATE_REQUESTED_EVENT, handler);
}
