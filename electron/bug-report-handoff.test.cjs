'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  GITHUB_NEW_ISSUE_URL,
  buildGitHubIssueBody,
  buildGitHubIssueUrl,
  createBugReportHandoff,
} = require('./bug-report-handoff.cjs');
const { captureWindowScreenshot } = require('./bug-report-screenshot.cjs');
const { createBugReportService } = require('./bug-report-service.cjs');

function snapshot(overrides = {}) {
  return {
    approvalId: 'approval-1',
    approvedAt: '2026-08-12T08:30:00.000Z',
    description: {
      happened: 'Opening a note showed a blank preview & stopped',
      expected: 'The note should render normally.',
      reproduction: '1. Open the note\n2. Switch to preview',
    },
    artifacts: [
      {
        kind: 'screenshot',
        resource: {
          bytes: Buffer.from('approved-png-bytes'),
          mimeType: 'image/png',
          width: 1440,
          height: 900,
        },
      },
      {
        kind: 'log',
        resource: {
          text: 'INFO MCP_BEARER_TOKEN=[REDACTED]\nINFO ready\n',
          byteLength: 49,
          truncated: true,
          redactionCount: 1,
        },
      },
      {
        kind: 'diagnostics',
        resource: {
          schemaVersion: 1,
          capturedAt: '2026-08-12T08:29:00.000Z',
          app: {
            name: 'StashBase',
            version: '1.3.2',
            packaged: false,
            electronVersion: '39.8.8',
          },
          os: { platform: 'win32', release: '10.0.26200', arch: 'x64' },
        },
      },
    ],
    ...overrides,
  };
}

async function temporaryRoot(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'stashbase-handoff-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test('Prepare Report materializes only approved artifacts without revealing the folder or opening GitHub', async (t) => {
  const root = await temporaryRoot(t);
  const base = path.join(root, 'bug-reports');
  const actions = [];
  let revealedDirectory = null;
  let openedUrl = null;
  const handoff = createBugReportHandoff({
    baseTemporaryDirectory: base,
    createSessionId: () => 'current-session',
    createReportId: () => 'report-one',
    createTemporaryId: () => 'write-one',
    revealDirectory: async (directory) => {
      actions.push('reveal');
      revealedDirectory = directory;
      assert.deepEqual((await fs.readdir(directory)).sort(), [
        'application-log.txt',
        'diagnostics.txt',
        'screenshot.png',
      ]);
    },
    openExternal: async (url) => {
      actions.push('browser');
      openedUrl = url;
    },
  });

  const result = await handoff.prepare(snapshot());

  assert.deepEqual(result, { ok: true, prepared: { artifactCount: 3 } });
  assert.deepEqual(actions, []);
  const preparedDirectory = path.join(base, 'session-current-session', 'report-report-one');
  assert.deepEqual((await fs.readdir(preparedDirectory)).sort(), [
    'application-log.txt',
    'diagnostics.txt',
    'screenshot.png',
  ]);

  const opened = await handoff.openGitHub(snapshot());

  assert.deepEqual(opened, { ok: true, prepared: { artifactCount: 3 } });
  assert.deepEqual(actions, ['reveal', 'browser']);
  assert.equal(revealedDirectory, preparedDirectory);
  assert.deepEqual(await fs.readFile(path.join(revealedDirectory, 'screenshot.png')), Buffer.from('approved-png-bytes'));
  const log = await fs.readFile(path.join(revealedDirectory, 'application-log.txt'), 'utf8');
  assert.equal(log, 'INFO MCP_BEARER_TOKEN=[REDACTED]\nINFO ready\n');
  assert.equal(log.includes('super-secret'), false);
  const diagnostics = await fs.readFile(path.join(revealedDirectory, 'diagnostics.txt'), 'utf8');
  assert.equal(diagnostics, [
    'Captured: 2026-08-12T08:29:00.000Z',
    'Application: StashBase',
    'Version: 1.3.2',
    'Mode: Development',
    'Electron: 39.8.8',
    'Platform: win32',
    'OS release: 10.0.26200',
    'Architecture: x64',
    '',
  ].join('\n'));
  assert.equal(diagnostics.includes('hostname'), false);
  assert.equal(diagnostics.includes('environment'), false);
  assert.equal(openedUrl, buildGitHubIssueUrl(snapshot()));
  assert.equal('directory' in result.prepared, false);
  assert.equal(JSON.stringify(result).includes(revealedDirectory), false);
});

test('captured PNG bytes remain unchanged through approval and prepared-file creation', async (t) => {
  const root = await temporaryRoot(t);
  const originalPng = Buffer.from('exact-captured-lossless-png');
  const captured = await captureWindowScreenshot({
    capturePage: async () => ({
      toPNG: () => originalPng,
      getSize: () => ({ width: 1280, height: 800 }),
    }),
  });
  const service = createBugReportService({
    createId: () => 'draft-one',
    createArtifactId: (() => {
      let next = 0;
      return () => `artifact-${++next}`;
    })(),
    createApprovalId: () => 'approval-exact-png',
    captureScreenshot: () => captured,
  });
  const created = await service.createDraft({ webContentsId: 17, windowId: 'window-one' });
  assert.equal(service.bindReviewWindow(created.draft.id, 29).ok, true);
  assert.equal(service.approveDraft(created.draft.id, 29).ok, true);
  const claimed = service.claimApprovedReport(created.draft.id, 29);
  assert.equal(claimed.ok, true);

  let revealedDirectory;
  const handoff = createBugReportHandoff({
    baseTemporaryDirectory: path.join(root, 'bug-reports'),
    createSessionId: () => 'session',
    createReportId: () => 'report',
    createTemporaryId: () => 'write',
    revealDirectory: async (directory) => { revealedDirectory = directory; },
    openExternal: async () => {},
  });
  const result = await handoff.prepare(claimed.snapshot);

  assert.equal(result.ok, true);
  await handoff.openGitHub(claimed.snapshot);
  const preparedPng = await fs.readFile(path.join(revealedDirectory, 'screenshot.png'));
  assert.deepEqual(preparedPng, originalPng);
});

test('GitHub handoff URL encodes only the four approved report sections', () => {
  const report = snapshot();
  const url = new URL(buildGitHubIssueUrl(report));

  assert.equal(`${url.origin}${url.pathname}`, GITHUB_NEW_ISSUE_URL);
  assert.equal(url.searchParams.get('title'), 'Opening a note showed a blank preview & stopped');
  const body = url.searchParams.get('body');
  assert.equal(body, buildGitHubIssueBody(report));
  for (const heading of [
    '## What happened',
    '## What did you expect to happen',
    '## Steps to reproduce',
    '## Environment',
  ]) assert.match(body, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(body, /- Application: StashBase/);
  assert.match(body, /- Version: 1\.3\.2/);
  assert.match(body, /- Mode: Development/);
  assert.match(body, /- Electron: 39\.8\.8/);
  assert.match(body, /- Platform: win32/);
  assert.match(body, /- OS release: 10\.0\.26200/);
  assert.match(body, /- Architecture: x64/);
  assert.equal(body.includes('## Attachments'), false);
  assert.equal(body.includes('Drag the prepared files'), false);
  assert.equal(body.includes('MCP_BEARER_TOKEN'), false);
  assert.equal(body.includes('approved-png-bytes'), false);
  assert.equal(body.includes('approval-1'), false);
  assert.equal(body.includes('artifact-'), false);
  assert.equal(body.includes(path.sep), false);
  assert.match(buildGitHubIssueUrl(report), /title=Opening\+a\+note/);
});

test('artifacts absent from the approved snapshot are not materialized', async (t) => {
  const root = await temporaryRoot(t);
  let revealedDirectory;
  const handoff = createBugReportHandoff({
    baseTemporaryDirectory: path.join(root, 'bug-reports'),
    createSessionId: () => 'session',
    createReportId: () => 'selected-only',
    createTemporaryId: () => 'write',
    revealDirectory: async (directory) => { revealedDirectory = directory; },
    openExternal: async () => {},
  });
  const approvedLogOnly = snapshot({
    approvalId: 'approval-log-only',
    artifacts: [snapshot().artifacts.find((artifact) => artifact.kind === 'log')],
  });

  const result = await handoff.prepare(approvedLogOnly);

  assert.deepEqual(result, { ok: true, prepared: { artifactCount: 1 } });
  assert.equal(revealedDirectory, undefined);
  const preparedDirectory = path.join(root, 'bug-reports', 'session-session', 'report-selected-only');
  assert.deepEqual(await fs.readdir(preparedDirectory), ['application-log.txt']);
  assert.equal(await fs.stat(path.join(preparedDirectory, 'screenshot.png')).then(() => true, () => false), false);
  assert.equal(await fs.stat(path.join(preparedDirectory, 'diagnostics.txt')).then(() => true, () => false), false);
});

test('concurrent preparation of one approved snapshot shares one materialized report', async (t) => {
  const root = await temporaryRoot(t);
  let reportIds = 0;
  const handoff = createBugReportHandoff({
    baseTemporaryDirectory: path.join(root, 'bug-reports'),
    createSessionId: () => 'session',
    createReportId: () => `report-${++reportIds}`,
    createTemporaryId: () => 'write',
    revealDirectory: async () => {},
    openExternal: async () => {},
  });
  const approved = snapshot({ approvalId: 'approval-concurrent' });

  const [first, second] = await Promise.all([handoff.prepare(approved), handoff.prepare(approved)]);

  assert.deepEqual(first, { ok: true, prepared: { artifactCount: 3 } });
  assert.deepEqual(second, first);
  assert.equal(reportIds, 1);
  assert.deepEqual(
    await fs.readdir(path.join(root, 'bug-reports', 'session-session')),
    ['report-report-1'],
  );
});

test('session initialization removes stale previous-session reports and keeps current reports', async (t) => {
  const root = await temporaryRoot(t);
  const base = path.join(root, 'bug-reports');
  const stale = path.join(base, 'session-previous', 'report-old');
  await fs.mkdir(stale, { recursive: true });
  await fs.writeFile(path.join(stale, 'application-log.txt'), 'stale');
  const handoff = createBugReportHandoff({
    baseTemporaryDirectory: base,
    createSessionId: () => 'fresh',
    createReportId: () => 'one',
    createTemporaryId: () => 'write',
    revealDirectory: async () => {},
    openExternal: async () => {},
  });

  await handoff.initializeSession();

  assert.equal(await fs.stat(stale).then(() => true, () => false), false);
  assert.deepEqual(await fs.readdir(base), ['session-fresh']);
  await handoff.prepare(snapshot({ approvalId: 'approval-current', artifacts: [] }));
  assert.deepEqual((await fs.readdir(path.join(base, 'session-fresh'))), ['report-one']);
});

test('handoff failures do not open later stages or expose the prepared path', async (t) => {
  const root = await temporaryRoot(t);
  let browserOpens = 0;
  const revealFailure = createBugReportHandoff({
    baseTemporaryDirectory: path.join(root, 'reveal-failure'),
    createSessionId: () => 'session',
    createReportId: () => 'report',
    createTemporaryId: () => 'write',
    revealDirectory: async () => { throw new Error('native failure with a private path'); },
    openExternal: async () => { browserOpens += 1; },
  });

  assert.equal((await revealFailure.prepare(snapshot())).ok, true);
  const revealResult = await revealFailure.openGitHub(snapshot());
  assert.equal(revealResult.error.code, 'REVEAL_FAILED');
  assert.equal(browserOpens, 0);
  assert.equal(/private path|reveal-failure/.test(JSON.stringify(revealResult)), false);

  let reveals = 0;
  const prepareFailure = createBugReportHandoff({
    baseTemporaryDirectory: path.join(root, 'prepare-failure'),
    createSessionId: () => 'session',
    createReportId: () => 'report',
    createTemporaryId: () => 'write',
    scanText: () => ({ safe: false }),
    revealDirectory: async () => { reveals += 1; },
    openExternal: async () => { browserOpens += 1; },
  });
  const prepareResult = await prepareFailure.prepare(snapshot({
    approvalId: 'approval-unsafe',
    artifacts: [snapshot().artifacts[1]],
  }));
  assert.equal(prepareResult.error.code, 'PREPARE_FAILED');
  assert.equal(reveals, 0);
  assert.equal(browserOpens, 0);
});

test('GitHub open failure reports a safe retryable error after the folder is revealed', async (t) => {
  const root = await temporaryRoot(t);
  let reveals = 0;
  const handoff = createBugReportHandoff({
    baseTemporaryDirectory: path.join(root, 'bug-reports'),
    createSessionId: () => 'session',
    createReportId: () => 'report',
    createTemporaryId: () => 'write',
    revealDirectory: async () => { reveals += 1; },
    openExternal: async () => { throw new Error('browser failure'); },
  });

  assert.equal((await handoff.prepare(snapshot())).ok, true);
  const result = await handoff.openGitHub(snapshot());

  assert.equal(reveals, 1);
  assert.equal(result.error.code, 'GITHUB_OPEN_FAILED');
  assert.deepEqual(result.prepared, { artifactCount: 3 });
  assert.equal('directory' in result.prepared, false);
});

test('Save Selected Artifacts copies only prepared files outside temporary cleanup', async (t) => {
  const root = await temporaryRoot(t);
  const base = path.join(root, 'bug-reports');
  const saved = path.join(root, 'saved-report');
  await fs.mkdir(saved);
  const handoff = createBugReportHandoff({
    baseTemporaryDirectory: base,
    createSessionId: () => 'current',
    createReportId: () => 'selected',
    createTemporaryId: () => 'write',
    revealDirectory: async () => {},
    openExternal: async () => {},
  });
  const selected = snapshot({
    approvalId: 'approval-selected-save',
    artifacts: snapshot().artifacts.filter((artifact) => artifact.kind !== 'screenshot'),
  });
  assert.equal((await handoff.prepare(selected)).ok, true);

  const result = await handoff.saveArtifacts(selected, saved);

  assert.deepEqual(result, { ok: true, saved: { artifactCount: 2 } });
  assert.deepEqual((await fs.readdir(saved)).sort(), ['application-log.txt', 'diagnostics.txt']);
  assert.equal(await fs.stat(path.join(saved, 'screenshot.png')).then(() => true, () => false), false);

  const nextSession = createBugReportHandoff({
    baseTemporaryDirectory: base,
    createSessionId: () => 'next',
    revealDirectory: async () => {},
    openExternal: async () => {},
  });
  await nextSession.initializeSession();
  assert.deepEqual((await fs.readdir(saved)).sort(), ['application-log.txt', 'diagnostics.txt']);
  assert.deepEqual(await fs.readdir(base), ['session-next']);
});
