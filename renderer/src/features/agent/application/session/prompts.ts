/** What the session remembers about prompts, from the moment one leaves the
 *  composer until a retry could resend it: the prompt held for a connection
 *  that is still opening, exactly what went out per transcript block, and the
 *  context snapshots of messages the composer pulled out of its queue. The
 *  queue reconciliation is a pure plan here, so the runtime only applies it. */
import type { AgentContextItem } from '@/features/agent/domain/context';
import type { AgentSkill } from '@/features/agent/domain/runtime-catalog';
import type { AgentQueuedPrompt, AgentSessionState } from '@/features/agent/domain/session';

/** How many pulled-out prompts keep their snapshot before the oldest is
 *  dropped; a composer never holds more than a screen of them. */
const MAX_DEQUEUED = 20;

/** A prompt on its way out: what the user sees, and what goes on the wire. */
export interface PendingPrompt {
  context: AgentContextItem[];
  display: string;
  /** The catalog entry armed when the prompt was sent, if any. */
  skill: AgentSkill | null;
  wire: string;
}

/** A queued message the composer took back, with the context it was queued
 *  with, kept until a dispatch names it. */
interface DequeuedPrompt {
  context: AgentContextItem[];
  skill: string | null;
  text: string;
}

/** What went out for one user turn, so a retry resends exactly that. */
interface SentTurn {
  skill: string | null;
  wire: string;
}

export interface AgentPromptLedger {
  /** Holds a prompt until the connection that will carry it is live. */
  hold(prompt: PendingPrompt): void;
  /** Takes the held prompt, leaving nothing behind. */
  takeHeld(): PendingPrompt | null;
  /** Records what went out under a transcript block id. */
  recordTurn(blockId: string, turn: SentTurn): void;
  turnFor(blockId: string): SentTurn | undefined;
  stash(promptId: string, prompt: DequeuedPrompt): void;
  /** Takes a stashed snapshot, so one dispatch consumes one snapshot. */
  takeStashed(promptId: string): DequeuedPrompt | undefined;
  /** Forgets every stashed snapshot; a retirement cancels them all. */
  clearStashed(): void;
}

export function createPromptLedger(): AgentPromptLedger {
  let held: PendingPrompt | null = null;
  const turnByBlock = new Map<string, SentTurn>();
  const stashed = new Map<string, DequeuedPrompt>();

  return {
    hold(prompt) {
      held = prompt;
    },
    takeHeld() {
      const prompt = held;
      held = null;
      return prompt;
    },
    recordTurn(blockId, turn) {
      turnByBlock.set(blockId, turn);
    },
    turnFor(blockId) {
      return turnByBlock.get(blockId);
    },
    stash(promptId, prompt) {
      stashed.set(promptId, prompt);
      while (stashed.size > MAX_DEQUEUED) {
        const oldest = stashed.keys().next().value;
        if (oldest === undefined) break;
        stashed.delete(oldest);
      }
    },
    takeStashed(promptId) {
      const prompt = stashed.get(promptId);
      stashed.delete(promptId);
      return prompt;
    },
    clearStashed() {
      stashed.clear();
    },
  };
}

/** One queue row as the composer reports it: context and skill are absent
 *  unless the composer is replaying a snapshot it already holds. */
export interface QueueEntry {
  id: string;
  text: string;
  context?: AgentContextItem[] | undefined;
  skill?: string | null | undefined;
}

/** What a queue report means for the session: the queue to store, the
 *  snapshots to stash for a later dispatch, and — when the draft's own
 *  binding moved into or out of the queue — where the bound context and the
 *  armed skill end up. */
export interface QueuePlan {
  queue: AgentQueuedPrompt[];
  stash: Array<{ id: string; prompt: DequeuedPrompt }>;
  /** The draft's context after the change, or null when it is unchanged. */
  context: AgentContextItem[] | null;
  /** The armed skill after the change, or undefined when it is unchanged. */
  skill?: string | null | undefined;
}

/** Reconciles a composer queue report against what the session already holds.
 *  The composer queues the draft, so the first genuinely new row carries the
 *  draft's bound context and armed skill with it; editing a queued message
 *  puts the text back in the composer, and its context follows the text. */
export function planQueue(state: AgentSessionState, entries: readonly QueueEntry[]): QueuePlan {
  const previous = new Map(state.queuedPrompts.map((prompt) => [prompt.id, prompt]));
  let draftTaken = false;
  const queue: AgentQueuedPrompt[] = entries.map((entry) => {
    if (entry.context) {
      return { context: entry.context, id: entry.id, skill: entry.skill ?? null, text: entry.text };
    }
    const known = previous.get(entry.id);
    if (known) return { ...known, text: entry.text };
    const context = draftTaken ? [] : state.context;
    const skill = draftTaken ? null : state.skill;
    draftTaken = true;
    return { context, id: entry.id, skill, text: entry.text };
  });

  const nextIds = new Set(entries.map((entry) => entry.id));
  const stash: QueuePlan['stash'] = [];
  let restored: AgentQueuedPrompt | null = null;
  for (const [promptId, prompt] of previous) {
    if (nextIds.has(promptId)) continue;
    if (!draftTaken && state.context.length === 0 && state.draft === prompt.text) {
      restored = prompt;
    } else {
      stash.push({
        id: promptId,
        prompt: { context: prompt.context, skill: prompt.skill, text: prompt.text },
      });
    }
  }

  if (restored) return { context: restored.context, queue, skill: restored.skill, stash };
  if (draftTaken) {
    return {
      context: state.context.length > 0 ? [] : null,
      queue,
      ...(state.skill ? { skill: null } : {}),
      stash,
    };
  }
  return { context: null, queue, stash };
}
