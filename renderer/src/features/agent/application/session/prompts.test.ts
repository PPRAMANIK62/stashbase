import { describe, expect, it } from 'vite-plus/test';

import type { AgentContextItem } from '@/features/agent/domain/context';
import { createAgentSessionState, type AgentSessionState } from '@/features/agent/domain/session';

import { createPromptLedger, planQueue } from './prompts';

const source: AgentContextItem = {
  boundVersion: null,
  format: 'md',
  kind: 'source',
  source: { folderPath: '/library/Research', path: 'notes.md' },
};

function session(overrides: Partial<AgentSessionState> = {}): AgentSessionState {
  return {
    ...createAgentSessionState({
      agent: 'codex',
      id: 'chat-1',
      scope: { kind: 'folder', path: '/library/Research' },
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

  it('remembers what went out per block and consumes a stashed snapshot once', () => {
    const ledger = createPromptLedger();
    ledger.recordTurn('user-1', { skill: 'review', wire: 'Review this' });
    ledger.stash('queued-1', { context: [source], skill: null, text: 'Later' });

    expect(ledger.turnFor('user-1')).toEqual({ skill: 'review', wire: 'Review this' });
    expect(ledger.turnFor('user-2')).toBeUndefined();
    expect(ledger.takeStashed('queued-1')?.context).toEqual([source]);
    expect(ledger.takeStashed('queued-1')).toBeUndefined();
  });

  it('drops the oldest snapshot once the stash is full', () => {
    const ledger = createPromptLedger();
    for (let index = 0; index < 21; index += 1) {
      ledger.stash(`queued-${index}`, { context: [], skill: null, text: `Message ${index}` });
    }

    expect(ledger.takeStashed('queued-0')).toBeUndefined();
    expect(ledger.takeStashed('queued-20')?.text).toBe('Message 20');
  });

  it('forgets every snapshot when the session is retired', () => {
    const ledger = createPromptLedger();
    ledger.stash('queued-1', { context: [], skill: null, text: 'Later' });
    ledger.clearStashed();

    expect(ledger.takeStashed('queued-1')).toBeUndefined();
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
    expect(plan.context).toEqual([]);
    expect(plan.skill).toBeNull();
    expect(plan.stash).toEqual([]);
  });

  it('gives the binding back when a queued message returns to the composer', () => {
    const queued = { context: [source], id: 'queued-1', skill: 'review', text: 'Later' };
    const plan = planQueue(session({ draft: 'Later', queuedPrompts: [queued] }), []);

    expect(plan.queue).toEqual([]);
    expect(plan.context).toEqual([source]);
    expect(plan.skill).toBe('review');
    expect(plan.stash).toEqual([]);
  });

  it('stashes a snapshot for a message that leaves the queue to be dispatched', () => {
    const queued = { context: [source], id: 'queued-1', skill: null, text: 'Later' };
    const plan = planQueue(session({ queuedPrompts: [queued] }), []);

    expect(plan.stash).toEqual([
      { id: 'queued-1', prompt: { context: [source], skill: null, text: 'Later' } },
    ]);
    expect(plan.context).toBeNull();
    expect(plan.skill).toBeUndefined();
  });

  it('keeps an existing row bound to its own snapshot when only its text is edited', () => {
    const queued = { context: [source], id: 'queued-1', skill: null, text: 'Later' };
    const plan = planQueue(session({ context: [], queuedPrompts: [queued] }), [
      { id: 'queued-1', text: 'Much later' },
    ]);

    expect(plan.queue).toEqual([{ ...queued, text: 'Much later' }]);
    expect(plan.stash).toEqual([]);
  });
});
