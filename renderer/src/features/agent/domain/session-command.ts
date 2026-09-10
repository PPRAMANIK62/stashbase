/** What the renderer asks a live session to do. Commands are the feature's
 *  own vocabulary — one member per verb the runtime exposes, with an absent
 *  choice spelled `null` rather than left off — and `infrastructure/session-api`
 *  is the only place that turns one into a frame on the socket. */
import type { AgentAccessMode } from '@/features/agent/domain/access';

export type AgentSessionCommand =
  /** Sends one user turn, optionally under the skill armed for it. */
  | { kind: 'prompt'; text: string; skill: string | null }
  | { kind: 'interrupt' }
  /** Answers one permission request; `always` remembers the decision. */
  | { kind: 'reply-permission'; id: string; allow: boolean; always: boolean | null }
  /** Picks a catalog model, or returns to the runtime's own choice. */
  | { kind: 'select-model'; model: string | null }
  | { kind: 'set-access-mode'; mode: AgentAccessMode }
  /** Asks a live runtime to re-read the skills it can run in this scope. */
  | { kind: 'refresh-skills' };
