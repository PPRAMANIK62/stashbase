/**
 * Which runtimes a conversation can run on, and what the catalog of them
 * looks like once it has left the transport.
 *
 * The registry below is the single place a runtime is declared: its id, the
 * label chats and titlebars read, and which entry a new chat falls back to.
 * Adding a runtime is one entry, so nothing else in the feature spells an
 * agent id out by hand.
 */
import type { AgentId } from '@/features/agent/domain/session';

/** What a turn on this runtime may use. The service advertises capabilities it
 *  may omit entirely; a conversation only ever asks yes or no, so absence is
 *  resolved at the adapter rather than at every read. */
export interface AgentAbilities {
  /** Whether this runtime can read transient uploaded bytes: an image or PDF
   *  picked, pasted, or dragged in from outside the library. It says nothing
   *  about referencing a library source, which is a path the agent reads back
   *  through MCP and which every runtime can use. A text-only model reports
   *  false here and still takes mentions and source drags. */
  readonly attachments: boolean;
  readonly effort: boolean;
  readonly models: boolean;
  readonly modes: boolean;
  readonly skills: boolean;
}

/**
 * One runtime as a conversation reads it: whether it can carry a turn right
 * now, what stands in the way when it cannot, and what a turn on it may use.
 *
 * Settings reads the same endpoint for a different question — how far staged
 * preparation has got — and models it separately for that reason. Neither
 * feature reads the other's shape, and neither reads the transport's.
 */
export interface Agent {
  readonly id: AgentId;
  readonly label: string;
  /** Whether this runtime can carry a conversation right now. */
  readonly ready: boolean;
  /** Whether the one thing between it and ready is the user signing in. */
  readonly needsSignIn: boolean;
  readonly abilities: AgentAbilities;
}

/** What the Agent service says it can run right now. `agents` — never the
 *  transport's own field name — is the vocabulary every reader uses. */
export interface AgentCatalog {
  readonly agents: readonly Agent[];
}

/** A declared runtime: the id the transport names it by and the label a
 *  reader sees. */
export interface AgentRuntimeEntry {
  readonly id: AgentId;
  readonly label: string;
}

/** The runtime a chat opens on when the catalog names nothing ready. */
const BUILT_IN: AgentRuntimeEntry = { id: 'stashbase', label: 'Wiki Agent' };

/** Every runtime this window can hold a conversation with, in the order
 *  chats and history lists present them. */
export const AGENT_RUNTIMES: readonly AgentRuntimeEntry[] = [
  { id: 'codex', label: 'Codex' },
  { id: 'claude', label: 'Claude Code' },
  BUILT_IN,
];

/** The one declared default. Nothing else may name a runtime id literally. */
export const DEFAULT_AGENT_ID: AgentId = BUILT_IN.id;

export const AGENT_ORDER: readonly AgentId[] = AGENT_RUNTIMES.map((entry) => entry.id);

export function agentLabel(id: AgentId): string {
  return AGENT_RUNTIMES.find((entry) => entry.id === id)?.label ?? id;
}

/**
 * Which runtime a new chat should open on, given the ones the catalog reports
 * ready. The declared default wins whenever it is ready; otherwise the first
 * ready runtime in registry order. Callers pass whatever they hold — catalog
 * rows or registry entries — so this one rule answers for every "New chat".
 */
export function preferredAgent<Entry extends { readonly id: AgentId }>(
  ready: readonly Entry[],
): Entry | undefined {
  const byRegistryOrder = AGENT_RUNTIMES.flatMap(
    (entry) => ready.find((candidate) => candidate.id === entry.id) ?? [],
  );
  return byRegistryOrder.find((entry) => entry.id === DEFAULT_AGENT_ID) ?? byRegistryOrder[0];
}
