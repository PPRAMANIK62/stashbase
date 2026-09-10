'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createBugReportReviewPreload,
} = require('../../dist/electron/bug-report/review-preload.cjs');

const DRAFT = {
  approval: null,
  artifacts: [{ available: true, id: 'artifact-1', included: true, kind: 'diagnostics' }],
  createdAt: '2026-08-06T12:00:00.000Z',
  description: { problem: 'It stopped responding.', reproduction: '' },
  state: 'reviewing',
  updatedAt: '2026-08-06T12:00:00.000Z',
};

const METHODS = [
  'discard',
  'excludeArtifact',
  'get',
  'getArtifactPreview',
  'includeArtifact',
  'openGitHub',
  'prepare',
  'reopen',
  'saveArtifacts',
  'updateDescription',
];

const VALID_ARGUMENT = {
  excludeArtifact: 'artifact-1',
  getArtifactPreview: 'artifact-1',
  includeArtifact: 'artifact-1',
  updateDescription: { problem: 'It froze.', reproduction: '' },
};

function createIpc(response) {
  const invocations = [];
  return {
    invocations,
    async invoke(channel, payload) {
      invocations.push([channel, payload]);
      if (response instanceof Error) throw response;
      return response;
    },
  };
}

test('review preload exposes exactly the ten frozen review operations', () => {
  const api = createBugReportReviewPreload(createIpc({ draft: DRAFT, ok: true }));

  assert.equal(Object.isFrozen(api), true);
  assert.deepEqual(Object.keys(api).sort(), METHODS);
});

test('review preload forwards validated requests on their declared channels', async () => {
  const ipc = createIpc({ draft: DRAFT, ok: true });
  const api = createBugReportReviewPreload(ipc);

  assert.deepEqual(await api.get(), { draft: DRAFT, ok: true });
  assert.equal((await api.includeArtifact('artifact-1')).ok, true);
  assert.equal((await api.excludeArtifact('artifact-1')).ok, true);
  assert.equal(
    (await api.updateDescription({ problem: 'It froze.', reproduction: 'Open it twice.' })).ok,
    true,
  );
  assert.deepEqual(ipc.invocations, [
    ['bug-report-review:get', undefined],
    ['bug-report-review:include-artifact', 'artifact-1'],
    ['bug-report-review:exclude-artifact', 'artifact-1'],
    [
      'bug-report-review:update-description',
      { problem: 'It froze.', reproduction: 'Open it twice.' },
    ],
  ]);
});

test('review preload rejects an invalid request before it reaches main', async () => {
  const ipc = createIpc({ draft: DRAFT, ok: true });
  const api = createBugReportReviewPreload(ipc);

  const rejected = [
    await api.getArtifactPreview(''),
    await api.includeArtifact(42),
    await api.excludeArtifact('a'.repeat(257)),
    await api.updateDescription({ draftId: 'another-draft', problem: '', reproduction: '' }),
    await api.updateDescription(null),
  ];

  for (const response of rejected) {
    assert.equal(response.ok, false);
    assert.equal(response.error.code, 'INVALID_REQUEST');
  }
  assert.deepEqual(ipc.invocations, []);
});

test('review preload fails closed on an undeclared response and never throws', async () => {
  const undeclared = createBugReportReviewPreload(
    createIpc({ draft: { ...DRAFT, id: 'private-draft' }, ok: true }),
  );
  const thrown = createBugReportReviewPreload(createIpc(new Error('no handler registered')));

  for (const api of [undeclared, thrown]) {
    for (const method of METHODS) {
      const response = await api[method](VALID_ARGUMENT[method]);
      assert.equal(response.ok, false, method);
      assert.equal(response.error.code, 'UNAVAILABLE', method);
    }
  }
});

test('review preload keeps a failed handoff that still names its approved report', async () => {
  const report = {
    approvedAt: '2026-08-06T12:00:00.000Z',
    artifacts: [{ id: 'artifact-1', kind: 'log' }],
    description: { problem: 'It froze.', reproduction: '' },
    state: 'approved',
  };
  const api = createBugReportReviewPreload(
    createIpc({
      error: { code: 'DOWNLOADS_FAILED', message: 'The report files could not be saved.' },
      ok: false,
      report,
    }),
  );

  const response = await api.prepare();
  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'DOWNLOADS_FAILED');
  assert.deepEqual(response.report, report);
});
