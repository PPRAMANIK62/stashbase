/** How one server event becomes session state. Most events *are* state and go
 *  straight to the reducer; this module exists for the ones that are not — a
 *  stream delta needing a fresh transcript block id, a failure that reads
 *  differently inside and outside a turn, and an ending that has to settle the
 *  transport as well. The two side channels a turn has — the prompt held for a
 *  still-opening connection, and the files a settled write touched — are handed
 *  in rather than reached for. */
import type { AgentTransport } from '@/features/agent/application/session/connection';
import type {
  AgentPromptLedger,
  PendingPrompt,
} from '@/features/agent/application/session/prompts';
import { fileChangesForTool } from '@/features/agent/domain/file-change';
import {
  latestUserBlock,
  type AgentSessionAction,
  type AgentSessionEvent,
  type AgentSessionState,
} from '@/features/agent/domain/session';

export interface AgentEventContext {
  ledger: AgentPromptLedger;
  /** A fresh transcript block id for the given block kind. */
  nextBlockId(kind: string): string;
  /** Reports the paths a settled write changed, under the live scope. */
  notifyFilesChanged(paths: string[]): void;
  state(): AgentSessionState;
  /** Sends a held prompt; false when the socket refused it. */
  submit(prompt: PendingPrompt): boolean;
  transition(action: AgentSessionAction): void;
  transport: AgentTransport;
}

/** A live connection puts the held prompt on the wire; a socket that refuses
 *  it hands the text and its bound context back to the composer. */
function flushHeldPrompt(context: AgentEventContext) {
  const prompt = context.ledger.takeHeld();
  if (!prompt || context.submit(prompt)) return;
  context.transition({ draft: prompt.display, kind: 'set-draft' });
  context.transition({ context: prompt.context, kind: 'set-context' });
}

/** A failure during a turn is transcript work with a retry offer; the same
 *  failure outside one stopped the connection. */
function applyFailure(
  context: AgentEventContext,
  event: Extract<AgentSessionEvent, { kind: 'failed' }>,
) {
  const state = context.state();
  if (state.connection.kind !== 'live') {
    context.transition({ kind: 'fail', message: event.message });
    return;
  }
  const prompt = latestUserBlock(state.transcript);
  const turn = prompt ? context.ledger.turnFor(prompt.id) : undefined;
  const errorId = context.nextBlockId('error');
  if (turn) context.ledger.recordTurn(errorId, turn);
  context.transition({
    failure: event.failure,
    id: errorId,
    kind: 'turn-fail',
    message: event.message,
    retryablePrompt: prompt && (turn?.wire ?? prompt.text),
  });
}

/** A tool the user already answered for keeps its answer; only a tool that
 *  settled cleanly reports the files it wrote. */
function applyToolFinished(
  context: AgentEventContext,
  event: Extract<AgentSessionEvent, { kind: 'tool-finished' }>,
) {
  const tool = context
    .state()
    .transcript.find((block) => block.kind === 'tool' && block.id === event.id);
  const settles = tool?.kind === 'tool' && tool.status !== 'denied' && tool.status !== 'cancelled';
  context.transition(event);
  if (!settles || event.isError) return;
  context.notifyFilesChanged(
    fileChangesForTool(tool.name, tool.input).map((change) => change.path),
  );
}

export function applyAgentSessionEvent(context: AgentEventContext, event: AgentSessionEvent): void {
  const { nextBlockId, transition, transport } = context;
  switch (event.kind) {
    case 'ready':
      transition(event);
      transport.syncAccessMode();
      flushHeldPrompt(context);
      return;
    case 'models':
      transition(event);
      if (event.fallback) {
        transition({ id: nextBlockId('notice'), kind: 'append-notice', message: event.fallback });
      }
      return;
    case 'tool-finished':
      applyToolFinished(context, event);
      return;
    case 'file-changed':
      transition(event);
      context.notifyFilesChanged([event.path]);
      return;
    case 'text':
      transition({ delta: event.delta, id: nextBlockId('reply'), kind: 'append-text' });
      return;
    case 'thinking':
      transition({ delta: event.delta, id: nextBlockId('thinking'), kind: 'append-thinking' });
      return;
    case 'notice':
      transition({ id: nextBlockId('notice'), kind: 'append-notice', message: event.message });
      return;
    case 'failed':
      applyFailure(context, event);
      return;
    case 'exited':
      transport.expectClose();
      transition({ kind: 'close', message: event.message });
      return;
    case 'scope-retired':
      transport.expectClose();
      transition({ kind: 'scope-changed', scope: { kind: 'folder', path: event.folderPath } });
      transition({ kind: 'retire' });
      return;
    default:
      // Everything else is state the runtime reported and nothing here has to
      // decide, so it reaches the reducer exactly as it arrived.
      transition(event);
  }
}
