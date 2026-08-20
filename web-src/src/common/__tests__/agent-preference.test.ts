import assert from 'node:assert/strict';
import test from 'node:test';
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

test('StashBase Agent is the default until the user chooses another Agent', () => {
  const storage = memoryStorage();

  assert.equal(DEFAULT_AGENT, 'stashbase');
  assert.equal(readPreferredAgent(storage), 'stashbase');

  rememberPreferredAgent('claude', storage);
  assert.equal(readPreferredAgent(storage), 'claude');
});

test('invalid or inaccessible Agent preferences recover to StashBase Agent', () => {
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
