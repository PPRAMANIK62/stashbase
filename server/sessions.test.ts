import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { sessionInfoMatchesSpace } from './routes/sessions.ts';

test('sessionInfoMatchesSpace only accepts sessions from the active space', () => {
  const space = path.resolve('/tmp/current-space');

  assert.equal(sessionInfoMatchesSpace({ cwd: space }, space), true);
  assert.equal(sessionInfoMatchesSpace({ cwd: path.join(space, '..', path.basename(space)) }, space), true);
  assert.equal(sessionInfoMatchesSpace({ cwd: '/tmp/other-space' }, space), false);
  assert.equal(sessionInfoMatchesSpace({ cwd: undefined }, space), false);
  assert.equal(sessionInfoMatchesSpace(null, space), false);
});
