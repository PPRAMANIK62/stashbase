'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createBugReportPreload } = require('../../dist/electron/bug-report/preload.cjs');

function createIpc(response) {
  const invocations = [];
  return {
    invocations,
    async invoke(channel) {
      invocations.push(channel);
      if (response instanceof Error) throw response;
      return response;
    },
  };
}

test('bug-report preload exposes one frozen open method on its own channel', async () => {
  const ipc = createIpc({ ok: true });
  const api = createBugReportPreload(ipc);

  assert.equal(Object.isFrozen(api), true);
  assert.deepEqual(Object.keys(api), ['open']);
  assert.deepEqual(await api.open(), { ok: true });
  assert.deepEqual(ipc.invocations, ['bug-report:open']);
});

test('bug-report preload passes through a declared failure', async () => {
  const failure = { failure: { kind: 'unauthorized', message: 'Not this window.' }, ok: false };
  const api = createBugReportPreload(createIpc(failure));

  assert.deepEqual(await api.open(), failure);
});

test('bug-report preload fails closed on an undeclared or thrown response', async () => {
  const undeclared = createBugReportPreload(createIpc({ ok: true, draftId: 'leaked' }));
  const thrown = createBugReportPreload(createIpc(new Error('no handler registered')));

  for (const api of [undeclared, thrown]) {
    const response = await api.open();
    assert.equal(response.ok, false);
    assert.equal(response.failure.kind, 'unavailable');
  }
});
