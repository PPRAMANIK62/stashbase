/** The Agent session reducer and the selectors that read its state. Every
 *  action lands in one exhaustive switch: transcript work is delegated to
 *  `session-transcript`, the connection moves as one discriminated union, and
 *  the composer, catalog and scope fields are edited in place. Selectors are
 *  the only way anything outside the domain asks a question about a session,
 *  so the union's shape stays an implementation detail of this module. */
import type { AgentSkill } from './runtime-catalog';
import {
  MAX_QUEUED_PROMPTS,
  type AgentActiveTurn,
  type AgentConnection,
  type AgentScope,
  type AgentSessionAction,
  type AgentSessionPhase,
  type AgentSessionState,
  type AgentSkillCatalog,
} from './session-state';
import {
  appendBlock,
  appendStreamingBlock,
  appendToolOutput,
  finishTool,
  recordFileChange,
  replyToolPermission,
  requestToolPermission,
  settleErrorBlock,
  settlePendingTools,
  startTool,
} from './session-transcript';

export {
  createAgentSessionState,
  type AgentConnection,
  type AgentId,
  type AgentQueuedPrompt,
  type AgentScope,
  type AgentSessionAction,
  type AgentSessionEvent,
  type AgentSessionPhase,
  type AgentSessionState,
  type AgentSkillCatalog,
} from './session-state';
import type { AgentTranscriptBlock } from './session-transcript';

export { latestUserBlock, type AgentTranscriptBlock } from './session-transcript';

// Connection

/** How many reconnects this connection has already spent. A connection that
 *  is not being retried has spent none, which is what resets the ladder after
 *  a successful `ready` or a manual reconnect. */
export function agentReconnectAttempt(connection: AgentConnection): number {
  return connection.kind === 'connecting' || connection.kind === 'reconnecting'
    ? connection.attempt
    : 0;
}

/** The turn being streamed, or null when nothing is running. */
function agentActiveTurn(connection: AgentConnection): AgentActiveTurn | null {
  return connection.kind === 'live' ? connection.turn : null;
}

export function agentTurnIsActive(connection: AgentConnection): boolean {
  return agentActiveTurn(connection) !== null;
}

/** Whether the connection can carry a prompt right now. A draft has no
 *  transport yet and opens one on the first send. */
export function agentCanSend(connection: AgentConnection): boolean {
  return connection.kind === 'draft' || (connection.kind === 'live' && connection.turn === null);
}

/** The coarse label tabs and status rows read. A retried connection is still
 *  connecting, and a failure is a connection that closed with a reason. */
export function agentSessionPhase(connection: AgentConnection): AgentSessionPhase {
  switch (connection.kind) {
    case 'reconnecting':
      return 'connecting';
    case 'failed':
      return 'closed';
    default:
      return connection.kind;
  }
}

// Skill catalog

/** The catalog the runtime just reported, as one value. The report is a flat
 *  triple on the wire, so this is where it becomes a state that cannot lie: a
 *  failed read keeps its reason and no skills, and a report carrying none is
 *  empty however the runtime spelled it. */
function skillCatalogOf(
  report: Extract<AgentSessionAction, { kind: 'skills' }>,
): AgentSkillCatalog {
  if (report.state === 'failed') {
    return { kind: 'failed', message: report.error ?? 'The Agent could not read its skills.' };
  }
  return report.skills.length > 0
    ? { kind: 'available', skills: report.skills }
    : { kind: 'empty' };
}

/** The skills the composer can offer right now. Only a stocked catalog has
 *  any, so an empty or failed one answers with none. */
export function agentSkills(catalog: AgentSkillCatalog): AgentSkill[] {
  return catalog.kind === 'available' ? catalog.skills : [];
}

/** Moves the turn inside a live connection. Any other connection has no turn
 *  to move, so turn actions arriving late are ignored rather than forging a
 *  live state the transport is not in. */
function withTurn(connection: AgentConnection, turn: AgentActiveTurn | null): AgentConnection {
  return connection.kind === 'live' ? { kind: 'live', turn } : connection;
}

// Reducer

export function transitionAgentSession(
  state: AgentSessionState,
  action: AgentSessionAction,
): AgentSessionState {
  switch (action.kind) {
    case 'connect':
      return { ...state, connection: { attempt: action.attempt, kind: 'connecting' } };
    case 'schedule-reconnect':
      return { ...state, connection: { attempt: action.attempt, kind: 'reconnecting' } };
    case 'ready':
      return { ...state, connection: { kind: 'live', turn: null } };
    case 'identified':
      return { ...state, nativeSessionId: action.id };
    case 'titled':
      return { ...state, title: action.title.trim() || state.title };
    case 'set-access-mode':
      return { ...state, accessMode: action.mode };
    case 'set-model':
      return { ...state, model: action.model };
    case 'set-effort':
      return { ...state, effort: action.effort };
    case 'models': {
      const catalogIds = new Set(action.models.map((model) => model.id));
      return {
        ...state,
        activeModel: action.activeModel ?? state.activeModel,
        models: action.models,
        model:
          action.fallback || (state.model && !catalogIds.has(state.model)) ? null : state.model,
      };
    }
    case 'skills': {
      const catalogIds = new Set(action.skills.map((skill) => skill.id));
      return {
        ...state,
        skill: state.skill && !catalogIds.has(state.skill) ? null : state.skill,
        skillCatalog: skillCatalogOf(action),
      };
    }
    case 'set-skill':
      return {
        ...state,
        skill:
          action.skill && agentSkills(state.skillCatalog).some((skill) => skill.id === action.skill)
            ? action.skill
            : null,
      };
    case 'set-draft':
      return { ...state, contextIssue: null, draft: action.draft };
    case 'set-context':
      return { ...state, context: action.context, contextIssue: null };
    case 'set-context-issue':
      return { ...state, contextIssue: action.message };
    case 'set-queue':
      return { ...state, queuedPrompts: action.queue.slice(0, MAX_QUEUED_PROMPTS) };
    case 'submit-prompt':
      return {
        ...state,
        connection: withTurn(state.connection, { promptBlockId: action.id }),
        context: [],
        contextIssue: null,
        draft: '',
        skill: null,
        transcript: appendBlock(state.transcript, {
          at: action.at,
          ...(action.context.length > 0 ? { context: action.context } : {}),
          id: action.id,
          kind: 'user',
          text: action.text,
        }),
      };
    case 'turn-started':
      return {
        ...state,
        connection: withTurn(
          state.connection,
          agentActiveTurn(state.connection) ?? { promptBlockId: null },
        ),
      };
    case 'append-text':
      return {
        ...state,
        transcript: appendStreamingBlock(state.transcript, 'assistant', action.id, action.delta),
      };
    case 'append-thinking':
      return {
        ...state,
        transcript: appendStreamingBlock(state.transcript, 'thinking', action.id, action.delta),
      };
    case 'tool-started':
      return sameTranscript(state, startTool(state.transcript, action));
    case 'tool-output':
      return {
        ...state,
        transcript: appendToolOutput(state.transcript, action.id, action.delta),
      };
    case 'tool-finished':
      return {
        ...state,
        transcript: finishTool(state.transcript, action.id, action.content, action.isError),
      };
    case 'file-changed':
      return sameTranscript(state, recordFileChange(state.transcript, action));
    case 'permission-requested':
      return { ...state, transcript: requestToolPermission(state.transcript, action) };
    case 'reply-permission':
      return {
        ...state,
        transcript: replyToolPermission(state.transcript, action.toolUseId, action.allow),
      };
    case 'turn-ended':
      return {
        ...state,
        connection: withTurn(state.connection, null),
        transcript: settlePendingTools(state.transcript, action.isError ? 'error' : 'done'),
      };
    case 'append-notice':
      return {
        ...state,
        transcript: appendBlock(state.transcript, {
          id: action.id,
          kind: 'notice',
          text: action.message,
        }),
      };
    case 'turn-fail':
      return {
        ...state,
        connection: withTurn(state.connection, null),
        transcript: appendBlock(settlePendingTools(state.transcript, 'error'), {
          failure: action.failure,
          id: action.id,
          kind: 'error',
          retryablePrompt: action.retryablePrompt,
          text: action.message,
        }),
      };
    case 'settle-error':
      return { ...state, transcript: settleErrorBlock(state.transcript, action.id) };
    case 'scope-changed':
      return { ...state, scope: action.scope };
    case 'fail':
      return {
        ...state,
        connection: { kind: 'failed', message: action.message },
        transcript: settlePendingTools(state.transcript, 'error'),
      };
    case 'close':
      return {
        ...state,
        connection: { kind: 'closed', message: action.message },
        transcript: settlePendingTools(state.transcript, 'error'),
      };
    case 'begin-restore':
      return { ...state, connection: { kind: 'restoring' }, title: action.title };
    case 'restore':
      return {
        ...state,
        effort: action.effort,
        lastModified: action.lastModified,
        nativeSessionId: action.nativeSessionId,
        transcript: action.transcript,
      };
    case 'retire':
      return {
        ...state,
        connection: { kind: 'retired' },
        contextIssue: null,
        queuedPrompts: [],
        transcript: retiredTranscript(state),
      };
    case 'dispose':
      return { ...state, connection: { kind: 'disposed' } };
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}

/** An edit a transcript helper declined to make leaves the state itself
 *  untouched, so a repeated event costs no subscriber a re-render. */
function sameTranscript(
  state: AgentSessionState,
  transcript: AgentTranscriptBlock[],
): AgentSessionState {
  return transcript === state.transcript ? state : { ...state, transcript };
}

/** Retirement cancels whatever was running and says how many queued messages
 *  went with the folder, so the transcript explains its own ending. */
function retiredTranscript(state: AgentSessionState) {
  const cancelled = settlePendingTools(state.transcript, 'cancelled');
  if (state.queuedPrompts.length === 0) return cancelled;
  const count = state.queuedPrompts.length;
  return appendBlock(cancelled, {
    id: `${state.id}-retired-queue`,
    kind: 'notice',
    text: `${count} queued ${count === 1 ? 'message was' : 'messages were'} cancelled when this folder was removed.`,
  });
}

// Session selectors

export function agentSessionIsBlank(state: AgentSessionState): boolean {
  return (
    state.nativeSessionId === null &&
    state.transcript.length === 0 &&
    state.draft.length === 0 &&
    state.skill === null &&
    state.context.length === 0 &&
    state.queuedPrompts.length === 0 &&
    !agentTurnIsActive(state.connection)
  );
}

// Scope

export function agentScopesEqual(left: AgentScope, right: AgentScope): boolean {
  return (
    left.kind === right.kind &&
    (left.kind === 'library' || (right.kind === 'folder' && left.path === right.path))
  );
}

export function scopeForWindowFolder(folderPath: string | null): AgentScope {
  return folderPath ? { kind: 'folder', path: folderPath } : { kind: 'library' };
}

/**
 * A scope's stable identity: the literal `library`, or the folder's path.
 *
 * One function because two readers need it to agree. The instructions editor
 * keys its read on it and the transport spells `?scope=` with it, and deriving
 * those separately is how an editor shows one scope's text and saves it into
 * another's.
 *
 * The Library's spelling is a literal, so it is only unambiguous because
 * folder paths are absolute. The route refuses a relative folder scope for the
 * same reason.
 */
export function agentScopeKey(scope: AgentScope): string {
  return scope.kind === 'library' ? 'library' : scope.path;
}

export function scopeLabel(scope: AgentScope): string {
  if (scope.kind === 'library') return 'Library';
  const normalized = scope.path.replace(/[\\/]+$/u, '');
  return normalized.split(/[\\/]/u).at(-1) || scope.path;
}
