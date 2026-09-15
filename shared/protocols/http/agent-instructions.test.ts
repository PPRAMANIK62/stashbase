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
      scope: { kind: 'folder', path: '/project' },
      text: 'Help with this project.',
    }),
    { customized: true, scope: { kind: 'folder', path: '/project' }, text: 'Help with this project.' },
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
  assert.deepEqual(agentInstructionsRequestSchema.parse({ scope: '/project', text: 'Be terse.' }), {
    scope: '/project',
    text: 'Be terse.',
  });
  assert.equal(
    agentInstructionsRequestSchema.safeParse({ scope: { kind: 'folder', path: '/project' }, text: '' }).success,
    false,
  );
});

test('an empty text is a valid write: it restores the packaged default', () => {
  assert.equal(agentInstructionsRequestSchema.safeParse({ scope: '/project', text: '' }).success, true);
});
