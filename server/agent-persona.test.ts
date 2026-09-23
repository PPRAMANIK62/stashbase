import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENT_PERSONA_PRESETS, MAX_AGENT_PERSONA_LENGTH } from '../shared/agent-persona.ts';
import { createAgentPersonaStore, readAgentPersonaPresets } from './agent-persona.ts';
import type { AppConfigFile } from './app-config.ts';

const presets = { marketer: 'Marketer prompt.', journalist: 'Journalist prompt.', storyteller: 'Storyteller prompt.' };

function fixture(initial: AppConfigFile = {}) {
  let config = structuredClone(initial);
  const store = createAgentPersonaStore({
    read: () => structuredClone(config),
    readStrict: () => structuredClone(config),
    write: (next) => { config = structuredClone(next); },
    equalPath: (left, right) => left.toLocaleLowerCase('en-US') === right.toLocaleLowerCase('en-US'),
    presets,
  });
  return { store, config: () => config };
}

test('a project runs no persona until one is chosen, and each project keeps its own', () => {
  const { store, config } = fixture({ appearance: { theme: 'dark' } });
  assert.equal(store.resolve('/Work/Alpha'), '');
  store.set({ kind: 'folder', path: '/Work/Alpha' }, { selected: 'journalist' });
  store.set({ kind: 'folder', path: '/Work/Beta' }, { custom: 'Write like me.', selected: 'custom' });

  assert.equal(store.resolve('/work/alpha'), 'Journalist prompt.');
  assert.equal(store.resolve('/work/beta'), 'Write like me.');
  assert.equal(config().appearance?.theme, 'dark');
});

test('the custom prompt survives choosing a preset and choosing none compacts config', () => {
  const { store, config } = fixture();
  const scope = { kind: 'folder', path: '/Work/Alpha' } as const;
  store.set(scope, { custom: '  Short sentences.  ', selected: 'custom' });
  assert.deepEqual(store.set(scope, { selected: 'storyteller' }), {
    scope,
    selected: 'storyteller',
    custom: 'Short sentences.',
  });
  store.set(scope, { selected: null, custom: '' });
  assert.equal(config().agentPersonas, undefined);
});

test('Custom cannot be chosen without a prompt, and clearing its prompt chooses none', () => {
  const { store } = fixture();
  const scope = { kind: 'folder', path: '/Work/Alpha' } as const;
  assert.throws(() => store.set(scope, { selected: 'custom' }), /Write a custom persona/);
  store.set(scope, { custom: 'Mine.', selected: 'custom' });
  assert.equal(store.set(scope, { custom: '   ' }).selected, null);
  assert.equal(store.resolve(scope.path), '');
});

test('a persona rejects unbounded input and defensively reads hand-edited config', () => {
  const tooLong = 'x'.repeat(MAX_AGENT_PERSONA_LENGTH + 1);
  const scope = { kind: 'folder', path: '/Work/Alpha' } as const;
  const { store } = fixture({ agentPersonas: { folders: [{ path: scope.path, selected: 'custom', custom: tooLong }] } });
  assert.equal(store.get(scope).custom.length, MAX_AGENT_PERSONA_LENGTH);
  assert.throws(() => store.set(scope, { custom: tooLong }), /characters or fewer/);

  const unknown = fixture({ agentPersonas: { folders: [{ path: scope.path, selected: 'poet' }] } });
  assert.equal(unknown.store.get(scope).selected, null);
  const empty = fixture({ agentPersonas: { folders: [{ path: scope.path, selected: 'custom' }] } });
  assert.equal(empty.store.resolve(scope.path), '');
});

test('a malformed persona object cannot block a later strict save', () => {
  const { store, config } = fixture({ agentPersonas: 'noise' as unknown as AppConfigFile['agentPersonas'] });
  const scope = { kind: 'folder', path: '/Work/Alpha' } as const;
  assert.equal(store.get(scope).selected, null);
  store.set(scope, { selected: 'marketer' });
  assert.deepEqual(config().agentPersonas, { folders: [{ path: '/Work/Alpha', selected: 'marketer' }] });
});

test('every packaged persona ships a prompt without internal runtime routing policy', () => {
  const packaged = readAgentPersonaPresets();
  assert.deepEqual(Object.keys(packaged), [...AGENT_PERSONA_PRESETS]);
  for (const text of Object.values(packaged)) {
    assert.match(text, /persona/i);
    assert.doesNotMatch(text, /StashBase MCP|mcp__stashbase__|`search_project`|`read_file`/i);
  }
});
