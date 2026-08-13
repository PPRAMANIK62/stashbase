'use strict';

const CHANNEL = Object.freeze({
  GET: 'bug-report-review:get',
  GET_ARTIFACT_PREVIEW: 'bug-report-review:get-artifact-preview',
  UPDATE_DESCRIPTION: 'bug-report-review:update-description',
  INCLUDE_ARTIFACT: 'bug-report-review:include-artifact',
  EXCLUDE_ARTIFACT: 'bug-report-review:exclude-artifact',
  PREPARE: 'bug-report-review:prepare',
  OPEN_GITHUB: 'bug-report-review:open-github',
  SAVE_ARTIFACTS: 'bug-report-review:save-artifacts',
  DISCARD: 'bug-report-review:discard',
});

const FORBIDDEN = Object.freeze({
  ok: false,
  error: Object.freeze({
    code: 'FORBIDDEN',
    message: 'This window cannot access a bug report review.',
  }),
});

function senderIdFromEvent(event) {
  const id = event?.sender?.id;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function createBugReportReviewIpcHandlers({
  bugReports,
  draftIdForSender,
  prepareApprovedReport,
  openPreparedReport,
  savePreparedReport,
}) {
  if (
    !bugReports
    || typeof draftIdForSender !== 'function'
    || typeof prepareApprovedReport !== 'function'
    || typeof openPreparedReport !== 'function'
    || typeof savePreparedReport !== 'function'
  ) {
    throw new TypeError('Bug-report review IPC dependencies are required.');
  }

  function authorize(event) {
    const senderId = senderIdFromEvent(event);
    if (senderId === null) return null;
    const draftId = draftIdForSender(senderId);
    return typeof draftId === 'string' && draftId ? { senderId, draftId } : null;
  }

  function withAuthorization(event, action) {
    const authorized = authorize(event);
    return authorized ? action(authorized.draftId, authorized.senderId) : FORBIDDEN;
  }

  return Object.freeze({
    get: (event) => withAuthorization(event, (draftId, senderId) => (
      bugReports.getReview(draftId, senderId)
    )),
    getArtifactPreview: (event, artifactId) => withAuthorization(event, (draftId, senderId) => (
      bugReports.getArtifactPreview(draftId, senderId, artifactId)
    )),
    updateDescription: (event, description) => withAuthorization(event, (draftId, senderId) => (
      bugReports.updateDescription(draftId, senderId, description)
    )),
    includeArtifact: (event, artifactId) => withAuthorization(event, (draftId, senderId) => (
      bugReports.includeArtifact(draftId, senderId, artifactId)
    )),
    excludeArtifact: (event, artifactId) => withAuthorization(event, (draftId, senderId) => (
      bugReports.excludeArtifact(draftId, senderId, artifactId)
    )),
    prepare: (event) => withAuthorization(event, async (draftId, senderId) => {
      const approved = bugReports.approveDraft(draftId, senderId);
      if (!approved.ok) return approved;
      const claimed = bugReports.claimApprovedReport(draftId, senderId);
      if (!claimed.ok) return claimed;
      const handoff = await prepareApprovedReport(claimed.snapshot);
      return handoff.ok
        ? { ok: true, report: claimed.report, prepared: handoff.prepared }
        : { ...handoff, report: claimed.report };
    }),
    openGitHub: (event) => withAuthorization(event, (draftId, senderId) => {
      const claimed = bugReports.claimApprovedReport(draftId, senderId);
      return claimed.ok ? openPreparedReport(claimed.snapshot) : claimed;
    }),
    saveArtifacts: (event) => withAuthorization(event, (draftId, senderId) => {
      const claimed = bugReports.claimApprovedReport(draftId, senderId);
      return claimed.ok ? savePreparedReport(claimed.snapshot, event) : claimed;
    }),
    discard: (event) => withAuthorization(event, (draftId, senderId) => (
      bugReports.discardDraft(draftId, senderId)
    )),
  });
}

function registerBugReportReviewIpc({
  ipcMain,
  bugReports,
  draftIdForSender,
  prepareApprovedReport,
  openPreparedReport,
  savePreparedReport,
}) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    throw new TypeError('Electron ipcMain is required.');
  }
  const handlers = createBugReportReviewIpcHandlers({
    bugReports,
    draftIdForSender,
    prepareApprovedReport,
    openPreparedReport,
    savePreparedReport,
  });
  ipcMain.handle(CHANNEL.GET, handlers.get);
  ipcMain.handle(CHANNEL.GET_ARTIFACT_PREVIEW, handlers.getArtifactPreview);
  ipcMain.handle(CHANNEL.UPDATE_DESCRIPTION, handlers.updateDescription);
  ipcMain.handle(CHANNEL.INCLUDE_ARTIFACT, handlers.includeArtifact);
  ipcMain.handle(CHANNEL.EXCLUDE_ARTIFACT, handlers.excludeArtifact);
  ipcMain.handle(CHANNEL.PREPARE, handlers.prepare);
  ipcMain.handle(CHANNEL.OPEN_GITHUB, handlers.openGitHub);
  ipcMain.handle(CHANNEL.SAVE_ARTIFACTS, handlers.saveArtifacts);
  ipcMain.handle(CHANNEL.DISCARD, handlers.discard);
  return handlers;
}

module.exports = {
  CHANNEL,
  createBugReportReviewIpcHandlers,
  registerBugReportReviewIpc,
};
