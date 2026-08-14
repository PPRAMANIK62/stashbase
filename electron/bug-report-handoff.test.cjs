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
      problem: 'Opening a note showed a blank preview & stopped',
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

test('Prepare Report materializes only approved artifacts without saving to Downloads or opening GitHub', async (t) => {
  const root = await temporaryRoot(t);
  const base = path.join(root, 'bug-reports');
  const downloads = path.join(root, 'downloads');
  await fs.mkdir(downloads);
  let openedUrl = null;
  const handoff = createBugReportHandoff({
    baseTemporaryDirectory: base,
    createSessionId: () => 'current-session',
    createReportId: () => 'report-one',
    createTemporaryId: () => 'write-one',
    downloadsDirectory: () => downloads,
    openExternal: async (url) => { openedUrl = url; },
  });

  const result = await handoff.prepare(snapshot());

  assert.deepEqual(result, { ok: true, prepared: { artifactCount: 3 } });
  assert.deepEqual(await fs.readdir(downloads), []);
  assert.equal(openedUrl, null);
  const preparedDirectory = path.join(base, 'session-current-session', 'report-report-one');
  assert.deepEqual((await fs.readdir(preparedDirectory)).sort(), [
    'application-log.txt',
    'diagnostics.txt',
    'screenshot.png',
  ]);

  const opened = await handoff.openGitHub(snapshot());

  assert.deepEqual(opened, { ok: true, prepared: { artifactCount: 3 } });
  const downloadsFolder = path.join(downloads, 'StashBase bug report');
  assert.deepEqual((await fs.readdir(downloadsFolder)).sort(), [
    'application-log.txt',
    'diagnostics.txt',
    'screenshot.png',
  ]);
  assert.deepEqual(await fs.readFile(path.join(downloadsFolder, 'screenshot.png')), Buffer.from('approved-png-bytes'));
  const log = await fs.readFile(path.join(downloadsFolder, 'application-log.txt'), 'utf8');
  assert.equal(log, 'INFO MCP_BEARER_TOKEN=[REDACTED]\nINFO ready\n');
  assert.equal(log.includes('super-secret'), false);
  const diagnostics = await fs.readFile(path.join(downloadsFolder, 'diagnostics.txt'), 'utf8');
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
  assert.equal(JSON.stringify([result, opened]).includes(root), false);
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

  const downloads = path.join(root, 'downloads');
  await fs.mkdir(downloads);
  const handoff = createBugReportHandoff({
    baseTemporaryDirectory: path.join(root, 'bug-reports'),
    createSessionId: () => 'session',
    createReportId: () => 'report',
    createTemporaryId: () => 'write',
    downloadsDirectory: () => downloads,
    openExternal: async () => {},
  });
  const result = await handoff.prepare(claimed.snapshot);

  assert.equal(result.ok, true);
  await handoff.openGitHub(claimed.snapshot);
  const preparedPng = await fs.readFile(path.join(downloads, 'StashBase bug report', 'screenshot.png'));
  assert.deepEqual(preparedPng, originalPng);
});

test('GitHub handoff URL encodes only the three approved report sections', () => {
  const report = snapshot();
  const url = new URL(buildGitHubIssueUrl(report));

  assert.equal(`${url.origin}${url.pathname}`, GITHUB_NEW_ISSUE_URL);
  assert.equal(url.searchParams.get('title'), 'Opening a note showed a blank preview & stopped');
  const body = url.searchParams.get('body');
  assert.equal(body, buildGitHubIssueBody(report));
  for (const heading of [
    '## Problem',
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
  const downloads = path.join(root, 'downloads');
  await fs.mkdir(downloads);
  const handoff = createBugReportHandoff({
    baseTemporaryDirectory: path.join(root, 'bug-reports'),
    createSessionId: () => 'session',
    createReportId: () => 'selected-only',
    createTemporaryId: () => 'write',
    downloadsDirectory: () => downloads,
    openExternal: async () => {},
  });
  const approvedLogOnly = snapshot({
    approvalId: 'approval-log-only',
    artifacts: [snapshot().artifacts.find((artifact) => artifact.kind === 'log')],
  });

  const result = await handoff.prepare(approvedLogOnly);

  assert.deepEqual(result, { ok: true, prepared: { artifactCount: 1 } });
  assert.deepEqual(await fs.readdir(downloads), []);
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
    downloadsDirectory: () => path.join(root, 'downloads'),
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
    downloadsDirectory: () => path.join(root, 'downloads'),
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
  const downloadsFailure = createBugReportHandoff({
    baseTemporaryDirectory: path.join(root, 'downloads-failure'),
    createSessionId: () => 'session',
    createReportId: () => 'report',
    createTemporaryId: () => 'write',
    downloadsDirectory: async () => { throw new Error('native failure with a private path'); },
    openExternal: async () => { browserOpens += 1; },
  });

  assert.equal((await downloadsFailure.prepare(snapshot())).ok, true);
  const downloadsResult = await downloadsFailure.openGitHub(snapshot());
  assert.equal(downloadsResult.error.code, 'DOWNLOADS_FAILED');
  assert.equal(browserOpens, 0);
  assert.equal(/private path|downloads-failure/.test(JSON.stringify(downloadsResult)), false);

  let downloadsLookups = 0;
  const prepareFailure = createBugReportHandoff({
    baseTemporaryDirectory: path.join(root, 'prepare-failure'),
    createSessionId: () => 'session',
    createReportId: () => 'report',
    createTemporaryId: () => 'write',
    scanText: () => ({ safe: false }),
    downloadsDirectory: () => { downloadsLookups += 1; return path.join(root, 'downloads'); },
    openExternal: async () => { browserOpens += 1; },
  });
  const prepareResult = await prepareFailure.prepare(snapshot({
    approvalId: 'approval-unsafe',
    artifacts: [snapshot().artifacts[1]],
  }));
  assert.equal(prepareResult.error.code, 'PREPARE_FAILED');
  assert.equal(downloadsLookups, 0);
  assert.equal(browserOpens, 0);
});

test('GitHub open failure reports a safe retryable error after the files reach Downloads', async (t) => {
  const root = await temporaryRoot(t);
  const downloads = path.join(root, 'downloads');
  await fs.mkdir(downloads);
  const handoff = createBugReportHandoff({
    baseTemporaryDirectory: path.join(root, 'bug-reports'),
    createSessionId: () => 'session',
    createReportId: () => 'report',
    createTemporaryId: () => 'write',
    downloadsDirectory: () => downloads,
    openExternal: async () => { throw new Error('browser failure'); },
  });

  assert.equal((await handoff.prepare(snapshot())).ok, true);
  const result = await handoff.openGitHub(snapshot());

  assert.equal(result.error.code, 'GITHUB_OPEN_FAILED');
  assert.deepEqual(result.prepared, { artifactCount: 3 });
  assert.equal('directory' in result.prepared, false);
  assert.deepEqual((await fs.readdir(path.join(downloads, 'StashBase bug report'))).sort(), [
    'application-log.txt',
    'diagnostics.txt',
    'screenshot.png',
  ]);

  // A retry of the same approval heals its folder instead of allocating another.
  assert.equal((await handoff.openGitHub(snapshot())).error.code, 'GITHUB_OPEN_FAILED');
  assert.deepEqual(await fs.readdir(downloads), ['StashBase bug report']);
});

test('each approval gets its own Downloads folder without overwriting earlier reports', async (t) => {
  const root = await temporaryRoot(t);
  const downloads = path.join(root, 'downloads');
  await fs.mkdir(downloads);
  let reportIds = 0;
  const handoff = createBugReportHandoff({
    baseTemporaryDirectory: path.join(root, 'bug-reports'),
    createSessionId: () => 'session',
    createReportId: () => `report-${++reportIds}`,
    createTemporaryId: () => 'write',
    downloadsDirectory: () => downloads,
    openExternal: async () => {},
  });
  const first = snapshot({ approvalId: 'approval-first' });
  const second = snapshot({
    approvalId: 'approval-second',
    artifacts: snapshot().artifacts.filter((artifact) => artifact.kind === 'log'),
  });

  assert.equal((await handoff.prepare(first)).ok, true);
  assert.equal((await handoff.openGitHub(first)).ok, true);
  assert.equal((await handoff.prepare(second)).ok, true);
  assert.equal((await handoff.openGitHub(second)).ok, true);

  assert.deepEqual((await fs.readdir(downloads)).sort(), [
    'StashBase bug report',
    'StashBase bug report 2',
  ]);
  assert.deepEqual((await fs.readdir(path.join(downloads, 'StashBase bug report'))).sort(), [
    'application-log.txt',
    'diagnostics.txt',
    'screenshot.png',
  ]);
  assert.deepEqual(await fs.readdir(path.join(downloads, 'StashBase bug report 2')), [
    'application-log.txt',
  ]);
});

test('Download copies only prepared files into Downloads outside temporary cleanup', async (t) => {
  const root = await temporaryRoot(t);
  const base = path.join(root, 'bug-reports');
  const downloads = path.join(root, 'downloads');
  await fs.mkdir(downloads);
  const handoff = createBugReportHandoff({
    baseTemporaryDirectory: base,
    createSessionId: () => 'current',
    createReportId: () => 'selected',
    createTemporaryId: () => 'write',
    downloadsDirectory: () => downloads,
    openExternal: async () => {},
  });
  const selected = snapshot({
    approvalId: 'approval-selected-save',
    artifacts: snapshot().artifacts.filter((artifact) => artifact.kind !== 'screenshot'),
  });
  assert.equal((await handoff.prepare(selected)).ok, true);

  const result = await handoff.saveToDownloads(selected);

  assert.deepEqual(result, { ok: true, saved: { artifactCount: 2 } });
  const saved = path.join(downloads, 'StashBase bug report');
  assert.deepEqual((await fs.readdir(saved)).sort(), ['application-log.txt', 'diagnostics.txt']);
  assert.equal(await fs.stat(path.join(saved, 'screenshot.png')).then(() => true, () => false), false);

  // Download and Open GitHub share the one folder owned by this approval.
  assert.equal((await handoff.openGitHub(selected)).ok, true);
  assert.deepEqual(await fs.readdir(downloads), ['StashBase bug report']);

  const nextSession = createBugReportHandoff({
    baseTemporaryDirectory: base,
    createSessionId: () => 'next',
    downloadsDirectory: () => downloads,
    openExternal: async () => {},
  });
  await nextSession.initializeSession();
  assert.deepEqual((await fs.readdir(saved)).sort(), ['application-log.txt', 'diagnostics.txt']);
  assert.deepEqual(await fs.readdir(base), ['session-next']);
});
