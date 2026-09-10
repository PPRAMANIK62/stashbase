/** Which of the three states a window is in, and why an unanswered catalog is
 *  not the same as nothing being ready. */
import { describe, expect, it } from 'vite-plus/test';

import { agentDefinition } from '@/test/fakes/agent';

import { agentGate } from './agent-catalog';

const READY = agentDefinition({ id: 'stashbase', ready: true });
const PENDING_CODEX = agentDefinition({ id: 'codex', label: 'Codex', ready: false });
const SIGN_IN_CLAUDE = agentDefinition({
  id: 'claude',
  label: 'Claude Code',
  needsSignIn: true,
  ready: false,
});

describe('agentGate', () => {
  it('is ready only when the runtime this chat is bound to can carry a turn', () => {
    expect(
      agentGate({ agents: [READY, PENDING_CODEX], loading: false, selected: 'stashbase' }),
    ).toEqual({ agent: READY, kind: 'ready' });
    // Another runtime being ready does not make this conversation sendable:
    // a chat is bound to one runtime and its transcript belongs to that one.
    expect(
      agentGate({ agents: [READY, PENDING_CODEX], loading: false, selected: 'codex' }),
    ).toMatchObject({ kind: 'setup' });
  });

  it('holds the offer back while the catalog has not answered', () => {
    expect(agentGate({ agents: [], loading: true, selected: 'stashbase' })).toEqual({
      kind: 'checking',
    });
    // Data wins over a stale loading flag, so a ready runtime is never drawn
    // as still being checked.
    expect(agentGate({ agents: [READY], loading: true, selected: 'stashbase' })).toEqual({
      agent: READY,
      kind: 'ready',
    });
  });

  it('offers every runtime that cannot carry a turn, in catalog order', () => {
    expect(
      agentGate({
        agents: [PENDING_CODEX, SIGN_IN_CLAUDE, READY],
        loading: false,
        selected: 'codex',
      }),
    ).toEqual({ kind: 'setup', pending: [PENDING_CODEX, SIGN_IN_CLAUDE] });
  });

  it('offers setup rather than checking once an answer arrives empty', () => {
    // A catalog that answered with nothing is an answer: the reader is told
    // what to do instead of watching an indefinite check.
    expect(agentGate({ agents: [], loading: false, selected: 'stashbase' })).toEqual({
      kind: 'setup',
      pending: [],
    });
  });
});
