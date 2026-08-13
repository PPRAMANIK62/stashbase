'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { scanBugReportText } = require('./bug-report-redaction.cjs');
const { ARTIFACT_KIND } = require('./bug-report-service.cjs');

const GITHUB_NEW_ISSUE_URL = 'https://github.com/liliu-z/stashbase/issues/new';

const HANDOFF_ERROR = Object.freeze({
  PREPARE_FAILED: Object.freeze({
    code: 'PREPARE_FAILED',
    message: 'StashBase could not prepare the selected report files. Nothing was opened. Please try again.',
  }),
  REVEAL_FAILED: Object.freeze({
    code: 'REVEAL_FAILED',
    message: 'The report files were prepared, but StashBase could not open their attachments folder. GitHub was not opened. Please try again.',
  }),
  GITHUB_OPEN_FAILED: Object.freeze({
    code: 'GITHUB_OPEN_FAILED',
    message: 'The report files were prepared and their folder was opened, but StashBase could not open GitHub. Please try again.',
  }),
  SAVE_FAILED: Object.freeze({
    code: 'SAVE_FAILED',
    message: 'StashBase could not save the selected report files. Please try again.',
  }),
});

function fail(error, artifactCount = null) {
  const result = { ok: false, error: { code: error.code, message: error.message } };
  if (Number.isSafeInteger(artifactCount) && artifactCount >= 0) {
    result.prepared = { artifactCount };
  }
  return result;
}

function createFilesystemId() {
  return crypto.randomBytes(18).toString('base64url');
}

function validFilesystemId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function inlineValue(value, fallback = 'Unavailable') {
  if (typeof value !== 'string') return fallback;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

function diagnosticsView(resource) {
  if (!resource || typeof resource !== 'object' || !resource.app || !resource.os) return null;
  return {
    capturedAt: inlineValue(resource.capturedAt),
    application: inlineValue(resource.app.name),
    version: inlineValue(resource.app.version),
    mode: resource.app.packaged === true ? 'Packaged' : 'Development',
    electron: inlineValue(resource.app.electronVersion),
    platform: inlineValue(resource.os.platform),
    osRelease: inlineValue(resource.os.release),
    architecture: inlineValue(resource.os.arch),
  };
}

function formatDiagnosticsArtifact(resource) {
  const diagnostics = diagnosticsView(resource);
  if (!diagnostics) throw new Error('Invalid diagnostics artifact');
  return [
    `Captured: ${diagnostics.capturedAt}`,
    `Application: ${diagnostics.application}`,
    `Version: ${diagnostics.version}`,
    `Mode: ${diagnostics.mode}`,
    `Electron: ${diagnostics.electron}`,
    `Platform: ${diagnostics.platform}`,
    `OS release: ${diagnostics.osRelease}`,
    `Architecture: ${diagnostics.architecture}`,
    '',
  ].join('\n');
}

function environmentMarkdown(snapshot) {
  const diagnosticsArtifact = snapshot?.artifacts?.find((artifact) => (
    artifact?.kind === ARTIFACT_KIND.DIAGNOSTICS
  ));
  const diagnostics = diagnosticsView(diagnosticsArtifact?.resource);
  if (!diagnostics) return '- Not included in this report.';
  return [
    `- Application: ${diagnostics.application}`,
    `- Version: ${diagnostics.version}`,
    `- Mode: ${diagnostics.mode}`,
    `- Electron: ${diagnostics.electron}`,
    `- Platform: ${diagnostics.platform}`,
    `- OS release: ${diagnostics.osRelease}`,
    `- Architecture: ${diagnostics.architecture}`,
  ].join('\n');
}

function issueTitle(snapshot) {
  const happened = inlineValue(snapshot?.description?.happened, '');
  if (happened) {
    const maximumLength = 100;
    return happened.length <= maximumLength
      ? happened
      : `${happened.slice(0, maximumLength - 1).trimEnd()}\u2026`;
  }
  const diagnosticsArtifact = snapshot?.artifacts?.find((artifact) => (
    artifact?.kind === ARTIFACT_KIND.DIAGNOSTICS
  ));
  const application = diagnosticsView(diagnosticsArtifact?.resource)?.application;
  return `${application && application !== 'Unavailable' ? application : 'StashBase'} bug report`;
}

function reportField(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '_Not provided._';
}

function buildGitHubIssueBody(snapshot) {
  return [
    '## What happened',
    '',
    reportField(snapshot?.description?.happened),
    '',
    '## What did you expect to happen',
    '',
    reportField(snapshot?.description?.expected),
    '',
    '## Steps to reproduce',
    '',
    reportField(snapshot?.description?.reproduction),
    '',
    '## Environment',
    '',
    environmentMarkdown(snapshot),
  ].join('\n');
}

function buildGitHubIssueUrl(snapshot) {
  const url = new URL(GITHUB_NEW_ISSUE_URL);
  url.searchParams.set('title', issueTitle(snapshot));
  url.searchParams.set('body', buildGitHubIssueBody(snapshot));
  return url.toString();
}

function artifactFile(artifact) {
  if (!artifact || typeof artifact !== 'object') throw new Error('Invalid artifact');
  if (artifact.kind === ARTIFACT_KIND.SCREENSHOT) {
    if (!Buffer.isBuffer(artifact.resource?.bytes) || artifact.resource.mimeType !== 'image/png') {
      throw new Error('Invalid screenshot artifact');
    }
    return { name: 'screenshot.png', content: artifact.resource.bytes, text: false };
  }
  if (artifact.kind === ARTIFACT_KIND.LOG) {
    if (typeof artifact.resource?.text !== 'string') throw new Error('Invalid log artifact');
    return { name: 'application-log.txt', content: artifact.resource.text, text: true };
  }
  if (artifact.kind === ARTIFACT_KIND.DIAGNOSTICS) {
    return { name: 'diagnostics.txt', content: formatDiagnosticsArtifact(artifact.resource), text: true };
  }
  throw new Error('Unsupported bug-report artifact');
}

function createBugReportHandoff({
  baseTemporaryDirectory,
  fsModule = fs,
  pathModule = path,
  scanText = scanBugReportText,
  createSessionId = createFilesystemId,
  createReportId = createFilesystemId,
  createTemporaryId = createFilesystemId,
  revealDirectory,
  openExternal,
} = {}) {
  if (
    typeof baseTemporaryDirectory !== 'string'
    || !pathModule.isAbsolute(baseTemporaryDirectory)
    || typeof revealDirectory !== 'function'
    || typeof openExternal !== 'function'
  ) {
    throw new TypeError('Bug-report handoff dependencies are required.');
  }

  let sessionDirectory = null;
  let initialization = null;
  const preparedByApproval = new Map();

  async function initializeSession() {
    if (sessionDirectory) return;
    if (!initialization) {
      initialization = (async () => {
        const sessionId = createSessionId();
        if (!validFilesystemId(sessionId)) throw new Error('Invalid bug-report session identifier');
        await fsModule.rm(baseTemporaryDirectory, { recursive: true, force: true });
        const nextSessionDirectory = pathModule.join(baseTemporaryDirectory, `session-${sessionId}`);
        await fsModule.mkdir(nextSessionDirectory, { recursive: true, mode: 0o700 });
        sessionDirectory = nextSessionDirectory;
      })().catch((error) => {
        initialization = null;
        throw error;
      });
    }
    await initialization;
  }

  async function writeAtomic(directory, file) {
    if (file.text && !scanText(file.content)?.safe) throw new Error('Final artifact privacy check failed');
    const temporaryId = createTemporaryId();
    if (!validFilesystemId(temporaryId)) throw new Error('Invalid temporary artifact identifier');
    const destination = pathModule.join(directory, file.name);
    const temporary = pathModule.join(directory, `.${file.name}.${temporaryId}.tmp`);
    try {
      await fsModule.writeFile(temporary, file.content, { flag: 'wx', mode: 0o600 });
      await fsModule.rename(temporary, destination);
    } catch (error) {
      await fsModule.rm(temporary, { force: true }).catch(() => {});
      throw error;
    }
  }

  async function materializeUncached(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || !validFilesystemId(snapshot.approvalId)) {
      throw new Error('Invalid approved report snapshot');
    }
    await initializeSession();

    const reportId = createReportId();
    if (!validFilesystemId(reportId)) throw new Error('Invalid bug-report identifier');
    const reportDirectory = pathModule.join(sessionDirectory, `report-${reportId}`);
    await fsModule.mkdir(reportDirectory, { recursive: false, mode: 0o700 });
    try {
      const files = snapshot.artifacts.map(artifactFile);
      for (const file of files) await writeAtomic(reportDirectory, file);
      const issueBody = buildGitHubIssueBody(snapshot);
      const title = issueTitle(snapshot);
      if (!scanText(issueBody)?.safe || !scanText(title)?.safe) {
        throw new Error('Final GitHub issue privacy check failed');
      }
      const prepared = Object.freeze({
        directory: reportDirectory,
        artifactCount: files.length,
        fileNames: Object.freeze(files.map((file) => file.name)),
        issueUrl: buildGitHubIssueUrl(snapshot),
      });
      return prepared;
    } catch (error) {
      await fsModule.rm(reportDirectory, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }

  async function materialize(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || !validFilesystemId(snapshot.approvalId)) {
      throw new Error('Invalid approved report snapshot');
    }
    const cached = preparedByApproval.get(snapshot.approvalId);
    if (cached) return cached;

    const inFlight = materializeUncached(snapshot);
    preparedByApproval.set(snapshot.approvalId, inFlight);
    try {
      return await inFlight;
    } catch (error) {
      if (preparedByApproval.get(snapshot.approvalId) === inFlight) {
        preparedByApproval.delete(snapshot.approvalId);
      }
      throw error;
    }
  }

  return Object.freeze({
    initializeSession,

    async prepare(snapshot) {
      try {
        const prepared = await materialize(snapshot);
        return { ok: true, prepared: { artifactCount: prepared.artifactCount } };
      } catch {
        return fail(HANDOFF_ERROR.PREPARE_FAILED);
      }
    },

    async openGitHub(snapshot) {
      const prepared = await preparedByApproval.get(snapshot?.approvalId);
      if (!prepared) return fail(HANDOFF_ERROR.PREPARE_FAILED);

      try {
        const revealed = await revealDirectory(prepared.directory);
        if (revealed === false || (typeof revealed === 'string' && revealed)) throw new Error('Reveal failed');
      } catch {
        return fail(HANDOFF_ERROR.REVEAL_FAILED, prepared.artifactCount);
      }

      try {
        const opened = await openExternal(prepared.issueUrl);
        if (opened === false || (typeof opened === 'string' && opened)) throw new Error('Open failed');
      } catch {
        return fail(HANDOFF_ERROR.GITHUB_OPEN_FAILED, prepared.artifactCount);
      }

      return { ok: true, prepared: { artifactCount: prepared.artifactCount } };
    },

    async saveArtifacts(snapshot, destinationDirectory) {
      const prepared = await preparedByApproval.get(snapshot?.approvalId);
      if (
        !prepared
        || typeof destinationDirectory !== 'string'
        || !pathModule.isAbsolute(destinationDirectory)
      ) return fail(HANDOFF_ERROR.SAVE_FAILED);

      let resolvedTemporaryRoot;
      let resolvedDestination;
      try {
        [resolvedTemporaryRoot, resolvedDestination] = await Promise.all([
          fsModule.realpath(baseTemporaryDirectory),
          fsModule.realpath(destinationDirectory),
        ]);
      } catch {
        return fail(HANDOFF_ERROR.SAVE_FAILED);
      }
      const relativeToTemporaryRoot = pathModule.relative(resolvedTemporaryRoot, resolvedDestination);
      if (
        relativeToTemporaryRoot === ''
        || (!relativeToTemporaryRoot.startsWith('..') && !pathModule.isAbsolute(relativeToTemporaryRoot))
      ) return fail(HANDOFF_ERROR.SAVE_FAILED);

      try {
        for (const fileName of prepared.fileNames) {
          await fsModule.copyFile(
            pathModule.join(prepared.directory, fileName),
            pathModule.join(destinationDirectory, fileName),
          );
        }
      } catch {
        return fail(HANDOFF_ERROR.SAVE_FAILED);
      }
      return { ok: true, saved: { artifactCount: prepared.artifactCount } };
    },
  });
}

module.exports = {
  GITHUB_NEW_ISSUE_URL,
  buildGitHubIssueBody,
  buildGitHubIssueUrl,
  createBugReportHandoff,
  formatDiagnosticsArtifact,
  issueTitle,
};
