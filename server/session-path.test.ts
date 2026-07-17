import assert from 'node:assert/strict';
import test from 'node:test';
import { sessionInfoMatchesCwd } from './agent.ts';
import { sessionInfoMatchesFolder } from './routes/sessions.ts';

test('empty external session paths are non-matches instead of path errors', () => {
  assert.doesNotThrow(() => sessionInfoMatchesCwd({ cwd: '' }, '/workspace'));
  assert.doesNotThrow(() => sessionInfoMatchesFolder({ cwd: '' }, '/workspace'));
  assert.equal(sessionInfoMatchesCwd({ cwd: '' }, '/workspace'), false);
  assert.equal(sessionInfoMatchesFolder({ cwd: '' }, '/workspace'), false);
});
