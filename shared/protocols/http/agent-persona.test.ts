import assert from 'node:assert/strict';
import { test } from 'node:test';

import { agentPersonaRequestSchema, agentPersonaStateSchema } from './agent-persona.ts';

test('state carries the chosen persona and the reader own prompt', () => {
  assert.deepEqual(
    agentPersonaStateSchema.parse({
      custom: 'Write like me.',
      scope: { kind: 'folder', path: '/project' },
      selected: 'journalist',
    }),
    { custom: 'Write like me.', scope: { kind: 'folder', path: '/project' }, selected: 'journalist' },
  );
  assert.equal(
    agentPersonaStateSchema.safeParse({ custom: '', scope: { kind: 'folder', path: '/p' }, selected: null })
      .success,
    true,
  );
});

test('state refuses an unknown persona and a scope without a path', () => {
  assert.equal(
    agentPersonaStateSchema.safeParse({ custom: '', scope: { kind: 'folder', path: '/p' }, selected: 'poet' })
      .success,
    false,
  );
  assert.equal(
    agentPersonaStateSchema.safeParse({ custom: '', scope: { kind: 'folder', path: '' }, selected: null })
      .success,
    false,
  );
});

test('the write sends the scope spelling the route reads and changes at least one field', () => {
  assert.deepEqual(agentPersonaRequestSchema.parse({ scope: '/project', selected: null }), {
    scope: '/project',
    selected: null,
  });
  assert.equal(agentPersonaRequestSchema.safeParse({ scope: '/project' }).success, false);
  assert.equal(
    agentPersonaRequestSchema.safeParse({ scope: { kind: 'folder', path: '/project' }, custom: 'x' }).success,
    false,
  );
});
