import { describe, expect, it } from 'vite-plus/test';

import type { AgentContextItem } from '@/features/agent/domain/context';
import { createAgentSessionState, type AgentSessionState } from '@/features/agent/domain/session';

import { createPromptLedger, planQueue } from './prompts';

const source: AgentContextItem = {
  boundVersion: null,
  format: 'md',
  kind: 'source',
  source: { folderPath: '/project/Research', path: 'notes.md' },
};

function session(overrides: Partial<AgentSessionState> = {}): AgentSessionState {
  return {
    ...createAgentSessionState({
      agent: 'codex',
      id: 'chat-1',
      scope: { kind: 'folder', path: '/project/Research' },
    }),
    ...overrides,
  };
}

describe('prompt ledger', () => {
  it('hands the held prompt out exactly once', () => {
    const ledger = createPromptLedger();
    const prompt = { context: [], display: 'Hi', skill: null, wire: 'Hi' };

    expect(ledger.takeHeld()).toBeNull();
    ledger.hold(prompt);
    expect(ledger.takeHeld()).toBe(prompt);
    expect(ledger.takeHeld()).toBeNull();
  });

  it('remembers the exact submission for a retry', () => {
    const ledger = createPromptLedger();
    ledger.recordTurn('user-1', { display: 'Review this', skill: 'review', wire: 'Review this' });
    expect(ledger.turnFor('user-1')).toEqual({
      display: 'Review this',
      skill: 'review',
      wire: 'Review this',
    });
    expect(ledger.turnFor('user-2')).toBeUndefined();
  });
});

describe('queue planning', () => {
  it('moves the draft binding onto the first newly queued message', () => {
    const plan = planQueue(session({ context: [source], draft: 'Later', skill: 'review' }), [
      { id: 'queued-1', text: 'Later' },
    ]);

    expect(plan.queue).toEqual([
      { context: [source], id: 'queued-1', skill: 'review', text: 'Later' },
    ]);
    expect(plan.draftTaken).toBe(true);
  });

  it('keeps an existing row bound to its own snapshot when only its text is edited', () => {
    const queued = { context: [source], id: 'queued-1', skill: null, text: 'Later' };
    const plan = planQueue(session({ context: [], queuedPrompts: [queued] }), [
      { id: 'queued-1', text: 'Much later' },
    ]);

    expect(plan.queue).toEqual([{ ...queued, text: 'Much later' }]);
    expect(plan.draftTaken).toBe(false);
  });
});
