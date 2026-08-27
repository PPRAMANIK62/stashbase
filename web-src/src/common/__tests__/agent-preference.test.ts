import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENT_META, AGENTS, builtInLauncherDetail } from '@/common/lib/agentCatalog';
import {
  DEFAULT_AGENT,
  newChatAgentSelectionPlan,
  readPreferredAgent,
  rememberPreferredAgent,
} from '@/common/lib/agentPreference';

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
  };
}

test('Built-in is selected until the user chooses another Agent', () => {
  const storage = memoryStorage();

  assert.equal(DEFAULT_AGENT, 'stashbase');
  assert.equal(readPreferredAgent(storage), 'stashbase');

  rememberPreferredAgent('claude', storage);
  assert.equal(readPreferredAgent(storage), 'claude');
});

test('invalid or inaccessible Agent preferences recover to Built-in', () => {
  assert.equal(readPreferredAgent(memoryStorage('other-agent')), 'stashbase');

  const inaccessible = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
  };
  assert.equal(readPreferredAgent(inaccessible), 'stashbase');
  assert.doesNotThrow(() => rememberPreferredAgent('claude', inaccessible));
});

test('choosing the agent only updates the next-chat preference', () => {
  assert.deepEqual(newChatAgentSelectionPlan('claude'), {
    preferredAgent: 'claude',
    startAgent: null,
  });
});

test('the Agent picker presents bring-your-own runtimes before the included Built-in Agent', () => {
  assert.deepEqual(AGENTS.map((agent) => [agent.id, agent.name]), [
    ['codex', 'Codex'],
    ['claude', 'Claude Code'],
    ['stashbase', 'Built-in'],
  ]);
  assert.equal(AGENT_META.stashbase.launcherLabel, 'Built-in');
  assert.equal(builtInLauncherDetail(false), 'Sign in for free credits');
  assert.equal(builtInLauncherDetail(true), 'Free credits included');
  assert.equal(builtInLauncherDetail(null), 'Free credits included');
});
