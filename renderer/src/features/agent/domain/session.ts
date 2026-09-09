import type { AgentContextItem } from '@/features/agent/domain/context';
import type {
  AgentAccessMode,
  AgentModel,
  AgentTurnFailure,
} from '@/protocols/websocket/agent-session';
import type { AgentId } from '@/shared/domain/agent-id';

export type { AgentId };

export type AgentScope = { kind: 'library' } | { kind: 'folder'; path: string };

export type AgentToolStatus = 'running' | 'awaiting' | 'done' | 'error' | 'denied' | 'cancelled';

const MAX_QUEUED_PROMPTS = 20;

export type AgentTranscriptBlock =
  | {
      kind: 'user';
      id: string;
      text: string;
      attachments?: Array<{
        path: string;
        name: string;
        dims?: string;
        previewUrl?: string;
      }>;
      /** The bound context this prompt was sent with. */
      context?: AgentContextItem[];
      at?: number;
    }
  | { kind: 'assistant'; id: string; text: string; at?: number }
  | { kind: 'thinking'; id: string; text: string }
  | { kind: 'notice'; id: string; text: string }
  | {
      kind: 'error';
      id: string;
      text: string;
      failure?: AgentTurnFailure;
      retryablePrompt?: string;
    }
  | {
      kind: 'tool';
      id: string;
      name: string;
      input: Record<string, unknown>;
      status: AgentToolStatus;
      permissionId?: string;
      permissionRequested?: boolean;
      permissionTitle?: string | null;
      result?: string;
    };

export type AgentSessionEvent =
  | { kind: 'ready' }
  | { kind: 'identified'; id: string }
  | { kind: 'titled'; title: string }
  | { kind: 'scope-changed'; scope: Extract<AgentScope, { kind: 'folder' }> }
  | {
      kind: 'models';
      models: AgentModel[];
      activeModel: string | null;
      fallback: string | null;
    }
  | { kind: 'turn-started' }
  | { kind: 'text'; delta: string }
  | { kind: 'thinking'; delta: string }
  | { kind: 'tool-started'; id: string; name: string; input: Record<string, unknown> }
  | { kind: 'tool-output'; id: string; delta: string }
  | { kind: 'tool-finished'; id: string; content: string; isError: boolean }
  | {
      kind: 'permission-requested';
      id: string;
      toolUseId: string;
      name: string;
      title: string | null;
      input: Record<string, unknown>;
    }
  | { kind: 'turn-ended'; isError: boolean }
  | { kind: 'notice'; message: string }
  | { kind: 'failed'; failure?: AgentTurnFailure; message: string }
  | { kind: 'exited'; message: string | null }
  | { kind: 'scope-retired'; folderPath: string };

export type AgentSessionPhase =
  | 'draft'
  | 'restoring'
  | 'connecting'
  | 'live'
  | 'closed'
  | 'retired'
  | 'disposed';

export interface AgentQueuedPrompt {
  id: string;
  text: string;
  /** Snapshot of the bound context taken when the prompt was queued. */
  context: AgentContextItem[];
}

export interface AgentSessionState {
  readonly id: string;
  readonly agent: AgentId;
  readonly scope: AgentScope;
  title: string;
  accessMode: AgentAccessMode;
  activeTurn: boolean;
  draft: string;
  /** Bound context for the draft: mentioned sources and transient uploads. */
  context: AgentContextItem[];
  /** Why the last send or attach was refused; cleared by any draft change. */
  contextIssue: string | null;
  queuedPrompts: AgentQueuedPrompt[];
  nativeSessionId: string | null;
  transcript: AgentTranscriptBlock[];
  lastModified: number;
  models: AgentModel[];
  model: string | null;
  activeModel: string | null;
  effort: string | null;
  phase: AgentSessionPhase;
  error: string | null;
  reconnectAttempt: number;
}

export function createAgentSessionState(options: {
  id: string;
  agent: AgentId;
  scope: AgentScope;
  title?: string;
}): AgentSessionState {
  if (!options.id.trim()) throw new Error('Agent session id must not be empty.');
  if (options.scope.kind === 'folder' && !options.scope.path.trim()) {
    throw new Error('Agent folder scope must not be empty.');
  }
  return {
    id: options.id,
    agent: options.agent,
    scope: options.scope,
    title: options.title?.trim() || 'New chat',
    accessMode: 'auto',
    activeTurn: false,
    draft: '',
    context: [],
    contextIssue: null,
    queuedPrompts: [],
    nativeSessionId: null,
    transcript: [],
    lastModified: 0,
    models: [],
    model: null,
    activeModel: null,
    effort: null,
    phase: 'draft',
    error: null,
    reconnectAttempt: 0,
  };
}

export type AgentSessionAction =
  | { type: 'connect' }
  | { type: 'reset-reconnect' }
  | { type: 'schedule-reconnect'; attempt: number }
  | { type: 'ready' }
  | { type: 'identify'; id: string }
  | { type: 'title'; title: string }
  | { type: 'set-access-mode'; mode: AgentAccessMode }
  | { type: 'set-model'; model: string | null }
  | { type: 'set-effort'; effort: string | null }
  | {
      type: 'set-model-catalog';
      models: AgentModel[];
      activeModel: string | null;
      fallback: string | null;
    }
  | { type: 'set-draft'; draft: string }
  | { type: 'set-context'; context: AgentContextItem[] }
  | { type: 'set-context-issue'; message: string | null }
  | { type: 'set-queue'; queue: AgentQueuedPrompt[] }
  | { type: 'submit-prompt'; id: string; text: string; context: AgentContextItem[]; at: number }
  | { type: 'turn-start' }
  | { type: 'append-text'; id: string; delta: string }
  | { type: 'append-thinking'; id: string; delta: string }
  | { type: 'start-tool'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'append-tool-output'; id: string; delta: string }
  | { type: 'finish-tool'; id: string; content: string; isError: boolean }
  | {
      type: 'request-permission';
      id: string;
      toolUseId: string;
      name: string;
      title: string | null;
      input: Record<string, unknown>;
    }
  | { type: 'reply-permission'; toolUseId: string; allow: boolean }
  | { type: 'turn-end'; isError: boolean }
  | { type: 'append-notice'; id: string; message: string }
  | {
      type: 'turn-fail';
      id: string;
      failure?: AgentTurnFailure;
      message: string;
      retryablePrompt?: string;
    }
  | { type: 'settle-error'; id: string }
  | { type: 'change-scope'; scope: Extract<AgentScope, { kind: 'folder' }> }
  | { type: 'fail'; message: string }
  | { type: 'close'; message: string | null }
  | { type: 'begin-restore'; title: string }
  | {
      type: 'restore';
      effort: string | null;
      lastModified: number;
      nativeSessionId: string;
      transcript: AgentTranscriptBlock[];
    }
  | { type: 'retire' }
  | { type: 'dispose' };

export function transitionAgentSession(
  state: AgentSessionState,
  action: AgentSessionAction,
): AgentSessionState {
  switch (action.type) {
    case 'connect':
      return { ...state, error: null, phase: 'connecting' };
    case 'reset-reconnect':
      return { ...state, reconnectAttempt: 0 };
    case 'schedule-reconnect':
      return { ...state, phase: 'connecting', reconnectAttempt: action.attempt };
    case 'ready':
      return { ...state, error: null, phase: 'live', reconnectAttempt: 0 };
    case 'identify':
      return { ...state, nativeSessionId: action.id };
    case 'title':
      return { ...state, title: action.title.trim() || state.title };
    case 'set-access-mode':
      return { ...state, accessMode: action.mode };
    case 'set-model':
      return { ...state, model: action.model };
    case 'set-effort':
      return { ...state, effort: action.effort };
    case 'set-model-catalog': {
      const catalogIds = new Set(action.models.map((model) => model.id));
      return {
        ...state,
        activeModel: action.activeModel ?? state.activeModel,
        models: action.models,
        model:
          action.fallback || (state.model && !catalogIds.has(state.model)) ? null : state.model,
      };
    }
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
        activeTurn: true,
        context: [],
        contextIssue: null,
        draft: '',
        transcript: [
          ...state.transcript,
          {
            at: action.at,
            ...(action.context.length > 0 ? { context: action.context } : {}),
            id: action.id,
            kind: 'user',
            text: action.text,
          },
        ],
      };
    case 'turn-start':
      return { ...state, activeTurn: true };
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
    case 'start-tool':
      return {
        ...state,
        transcript: startTool(state.transcript, action),
      };
    case 'append-tool-output':
      return {
        ...state,
        transcript: state.transcript.map((block) =>
          block.kind === 'tool' &&
          block.id === action.id &&
          block.status !== 'denied' &&
          block.status !== 'cancelled'
            ? { ...block, result: (block.result ?? '') + action.delta }
            : block,
        ),
      };
    case 'finish-tool':
      return {
        ...state,
        transcript: state.transcript.map((block) =>
          block.kind === 'tool' &&
          block.id === action.id &&
          block.status !== 'denied' &&
          block.status !== 'cancelled'
            ? {
                ...block,
                permissionId: undefined,
                permissionRequested: false,
                permissionTitle: undefined,
                result: action.content,
                status: action.isError ? ('error' as const) : ('done' as const),
              }
            : block,
        ),
      };
    case 'request-permission':
      return {
        ...state,
        transcript: requestToolPermission(state.transcript, action),
      };
    case 'reply-permission':
      return {
        ...state,
        transcript: state.transcript.map((block) =>
          block.kind === 'tool' && block.id === action.toolUseId && block.status === 'awaiting'
            ? {
                ...block,
                permissionId: undefined,
                status: action.allow ? ('running' as const) : ('denied' as const),
              }
            : block,
        ),
      };
    case 'turn-end':
      return {
        ...state,
        activeTurn: false,
        transcript: settlePendingTools(state.transcript, action.isError ? 'error' : 'done'),
      };
    case 'append-notice':
      return {
        ...state,
        transcript: [...state.transcript, { id: action.id, kind: 'notice', text: action.message }],
      };
    case 'turn-fail':
      return {
        ...state,
        activeTurn: false,
        transcript: [
          ...settlePendingTools(state.transcript, 'error'),
          {
            failure: action.failure,
            id: action.id,
            kind: 'error',
            retryablePrompt: action.retryablePrompt,
            text: action.message,
          },
        ],
      };
    case 'settle-error':
      return {
        ...state,
        transcript: state.transcript.map((block) =>
          block.kind === 'error' && block.id === action.id
            ? { ...block, retryablePrompt: undefined }
            : block,
        ),
      };
    case 'change-scope':
      return { ...state, scope: action.scope };
    case 'fail':
      return {
        ...state,
        activeTurn: false,
        error: action.message,
        phase: 'closed',
        transcript: settlePendingTools(state.transcript, 'error'),
      };
    case 'close':
      return {
        ...state,
        activeTurn: false,
        error: action.message,
        phase: 'closed',
        transcript: settlePendingTools(state.transcript, 'error'),
      };
    case 'begin-restore':
      return { ...state, error: null, phase: 'restoring', title: action.title };
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
        activeTurn: false,
        contextIssue: null,
        error: null,
        phase: 'retired',
        queuedPrompts: [],
        transcript: [
          ...settlePendingTools(state.transcript, 'cancelled'),
          ...(state.queuedPrompts.length > 0
            ? [
                {
                  id: `${state.id}-retired-queue`,
                  kind: 'notice' as const,
                  text: `${state.queuedPrompts.length} queued ${state.queuedPrompts.length === 1 ? 'message was' : 'messages were'} cancelled when this folder was removed.`,
                },
              ]
            : []),
        ],
      };
    case 'dispose':
      return { ...state, phase: 'disposed' };
  }
}

export function agentSessionIsBlank(state: AgentSessionState): boolean {
  return (
    state.nativeSessionId === null &&
    state.transcript.length === 0 &&
    state.draft.length === 0 &&
    state.context.length === 0 &&
    state.queuedPrompts.length === 0 &&
    !state.activeTurn
  );
}

function appendStreamingBlock(
  transcript: AgentTranscriptBlock[],
  kind: 'assistant' | 'thinking',
  id: string,
  delta: string,
): AgentTranscriptBlock[] {
  const last = transcript.at(-1);
  if (last?.kind === kind) {
    return [...transcript.slice(0, -1), { ...last, text: last.text + delta }];
  }
  return [...transcript, { id, kind, text: delta }];
}

function startTool(
  transcript: AgentTranscriptBlock[],
  action: Extract<AgentSessionAction, { type: 'start-tool' }>,
): AgentTranscriptBlock[] {
  const index = transcript.findIndex((block) => block.kind === 'tool' && block.id === action.id);
  if (index < 0) {
    return [
      ...transcript,
      { id: action.id, input: action.input, kind: 'tool', name: action.name, status: 'running' },
    ];
  }
  const next = transcript.slice();
  const current = next[index];
  if (current?.kind === 'tool') {
    if (['cancelled', 'denied', 'done', 'error'].includes(current.status)) return transcript;
    next[index] = {
      ...current,
      input: action.input,
      name: action.name,
      status: current.status === 'awaiting' ? 'awaiting' : 'running',
    };
  }
  return next;
}

function requestToolPermission(
  transcript: AgentTranscriptBlock[],
  action: Extract<AgentSessionAction, { type: 'request-permission' }>,
): AgentTranscriptBlock[] {
  const index = transcript.findIndex(
    (block) => block.kind === 'tool' && block.id === action.toolUseId,
  );
  const permissionBlock: Extract<AgentTranscriptBlock, { kind: 'tool' }> = {
    id: action.toolUseId,
    input: action.input,
    kind: 'tool',
    name: action.name,
    permissionId: action.id,
    permissionRequested: true,
    permissionTitle: action.title,
    status: 'awaiting',
  };
  if (index < 0) return [...transcript, permissionBlock];
  const next = transcript.slice();
  const current = next[index];
  next[index] = current?.kind === 'tool' ? { ...current, ...permissionBlock } : permissionBlock;
  return next;
}

function settlePendingTools(
  transcript: AgentTranscriptBlock[],
  status: 'done' | 'error' | 'cancelled',
): AgentTranscriptBlock[] {
  return transcript.map((block) =>
    block.kind === 'tool' && (block.status === 'running' || block.status === 'awaiting')
      ? {
          ...block,
          permissionId: undefined,
          status,
        }
      : block,
  );
}

export function agentScopesEqual(left: AgentScope, right: AgentScope): boolean {
  return (
    left.kind === right.kind &&
    (left.kind === 'library' || (right.kind === 'folder' && left.path === right.path))
  );
}

export function scopeForWindowFolder(folderPath: string | null): AgentScope {
  return folderPath ? { kind: 'folder', path: folderPath } : { kind: 'library' };
}

export function scopeLabel(scope: AgentScope): string {
  if (scope.kind === 'library') return 'Library';
  const normalized = scope.path.replace(/[\\/]+$/u, '');
  return normalized.split(/[\\/]/u).at(-1) || scope.path;
}
