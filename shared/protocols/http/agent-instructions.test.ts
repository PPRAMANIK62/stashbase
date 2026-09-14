import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  agentInstructionsRequestSchema,
  agentInstructionsStateSchema,
} from './agent-instructions.ts';

test('state carries the text and whether it is the reader own', () => {
  assert.deepEqual(
    agentInstructionsStateSchema.parse({
      customized: true,
      scope: { kind: 'unbound' },
      text: 'Find work across folders.',
    }),
    { customized: true, scope: { kind: 'unbound' }, text: 'Find work across folders.' },
  );
});

test('state refuses a scope that names neither kind', () => {
  assert.equal(
    agentInstructionsStateSchema.safeParse({ customized: false, scope: { kind: 'window' }, text: '' })
      .success,
    false,
  );
  assert.equal(
    agentInstructionsStateSchema.safeParse({ customized: false, scope: { kind: 'folder' }, text: '' })
      .success,
    false,
  );
});

test('a project scope carries no path, and a folder scope must', () => {
  assert.equal(
    agentInstructionsStateSchema.safeParse({
      customized: false,
      scope: { kind: 'unbound', path: '/x' },
      text: '',
    }).success,
    false,
  );
  assert.equal(
    agentInstructionsStateSchema.safeParse({ customized: false, scope: { kind: 'folder', path: '' }, text: '' })
      .success,
    false,
  );
});

test('the write sends the scope spelling the route reads, not the object', () => {
  assert.deepEqual(agentInstructionsRequestSchema.parse({ scope: 'unbound', text: 'Be terse.' }), {
    scope: 'unbound',
    text: 'Be terse.',
  });
  assert.equal(
    agentInstructionsRequestSchema.safeParse({ scope: { kind: 'unbound' }, text: '' }).success,
    false,
  );
});

test('an empty text is a valid write: it restores the packaged default', () => {
  assert.equal(agentInstructionsRequestSchema.safeParse({ scope: 'unbound', text: '' }).success, true);
});
