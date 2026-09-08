import type { AgentId } from '@/shared/domain/agent-id';

export type { AgentId };

export type AgentScope = { kind: 'library' } | { kind: 'folder'; path: string };

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
      at?: number;
    }
  | { kind: 'assistant'; id: string; text: string; at?: number }
  | { kind: 'thinking'; id: string; text: string }
  | {
      kind: 'tool';
      id: string;
      name: string;
      input: Record<string, unknown>;
      status: 'done' | 'error';
      result?: string;
    };

export type AgentSessionEvent =
  | { kind: 'ready' }
  | { kind: 'identified'; id: string }
  | { kind: 'titled'; title: string }
  | { kind: 'scope-changed'; scope: Extract<AgentScope, { kind: 'folder' }> }
  | { kind: 'failed'; message: string }
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

export interface AgentSessionState {
  readonly id: string;
  readonly agent: AgentId;
  readonly scope: AgentScope;
  title: string;
  nativeSessionId: string | null;
  transcript: AgentTranscriptBlock[];
  lastModified: number;
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
    nativeSessionId: null,
    transcript: [],
    lastModified: 0,
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
    case 'change-scope':
      return { ...state, scope: action.scope };
    case 'fail':
      return { ...state, error: action.message, phase: 'closed' };
    case 'close':
      return { ...state, error: action.message, phase: 'closed' };
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
      return { ...state, error: null, phase: 'retired' };
    case 'dispose':
      return { ...state, phase: 'disposed' };
  }
}

export function agentSessionIsBlank(state: AgentSessionState): boolean {
  return state.nativeSessionId === null && state.transcript.length === 0;
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
