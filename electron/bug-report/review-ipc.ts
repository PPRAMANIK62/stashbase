import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import type { z } from 'zod';

import {
  BUG_REPORT_REVIEW_CHANNEL,
  type BugReportDescription,
  bugReportArtifactIdSchema,
  bugReportArtifactPreviewResponseSchema,
  bugReportDescriptionSchema,
  bugReportDiscardResponseSchema,
  bugReportOpenGitHubResponseSchema,
  bugReportPrepareResponseSchema,
  bugReportReviewDraftResponseSchema,
  bugReportSaveArtifactsResponseSchema,
} from '../../shared/protocols/electron/bug-report-review.ts';

type HandoffResult = Record<string, unknown> & { ok: boolean };

/** Only the review operations this boundary calls. The service itself stays
 *  the authority on drafts, approval, and privacy. */
export interface BugReportReviewService {
  approveDraft(draftId: string, senderId: number): { ok: boolean };
  claimApprovedReport(
    draftId: string,
    senderId: number,
  ): { ok: true; report: unknown; snapshot: unknown } | { ok: false };
  discardDraft(draftId: string, senderId: number): unknown;
  excludeArtifact(draftId: string, senderId: number, artifactId: string): unknown;
  getArtifactPreview(draftId: string, senderId: number, artifactId: string): unknown;
  getReview(draftId: string, senderId: number): unknown;
  includeArtifact(draftId: string, senderId: number, artifactId: string): unknown;
  reopenReview(draftId: string, senderId: number): unknown;
  updateDescription(draftId: string, senderId: number, description: BugReportDescription): unknown;
}

export interface BugReportReviewDependencies {
  bugReports: BugReportReviewService;
  draftIdForSender(senderWebContentsId: number): string | null | undefined;
  ipcMain: Pick<IpcMain, 'handle'>;
  isReviewFrameUrl(url: string): boolean;
  openPreparedReport(snapshot: unknown): Promise<HandoffResult> | HandoffResult;
  prepareApprovedReport(snapshot: unknown): Promise<HandoffResult> | HandoffResult;
  savePreparedReport(snapshot: unknown): Promise<HandoffResult> | HandoffResult;
}

interface ReviewFailure {
  error: { code: 'FORBIDDEN' | 'INVALID_REQUEST' | 'UNAVAILABLE'; message: string };
  ok: false;
}

const FORBIDDEN: ReviewFailure = Object.freeze({
  error: Object.freeze({
    code: 'FORBIDDEN' as const,
    message: 'This window cannot access a bug report review.',
  }),
  ok: false as const,
});

const INVALID_REQUEST: ReviewFailure = Object.freeze({
  error: Object.freeze({
    code: 'INVALID_REQUEST' as const,
    message: 'The bug report request was invalid.',
  }),
  ok: false as const,
});

const UNAVAILABLE: ReviewFailure = Object.freeze({
  error: Object.freeze({
    code: 'UNAVAILABLE' as const,
    message: 'The bug report review is unavailable.',
  }),
  ok: false as const,
});

export interface BugReportReviewHandlers {
  discard(event: IpcMainInvokeEvent): Promise<unknown>;
  excludeArtifact(event: IpcMainInvokeEvent, artifactId: unknown): Promise<unknown>;
  get(event: IpcMainInvokeEvent): Promise<unknown>;
  getArtifactPreview(event: IpcMainInvokeEvent, artifactId: unknown): Promise<unknown>;
  includeArtifact(event: IpcMainInvokeEvent, artifactId: unknown): Promise<unknown>;
  openGitHub(event: IpcMainInvokeEvent): Promise<unknown>;
  prepare(event: IpcMainInvokeEvent): Promise<unknown>;
  reopen(event: IpcMainInvokeEvent): Promise<unknown>;
  saveArtifacts(event: IpcMainInvokeEvent): Promise<unknown>;
  updateDescription(event: IpcMainInvokeEvent, description: unknown): Promise<unknown>;
}

export function createBugReportReviewIpcHandlers(
  dependencies: BugReportReviewDependencies,
): BugReportReviewHandlers {
  const { bugReports } = dependencies;

  function authorize(event: IpcMainInvokeEvent): { draftId: string; senderId: number } | null {
    const frame = event.senderFrame;
    if (!frame || frame !== event.sender.mainFrame) return null;
    if (!dependencies.isReviewFrameUrl(frame.url)) return null;
    const senderId = event.sender.id;
    if (!Number.isSafeInteger(senderId) || senderId <= 0) return null;
    const draftId = dependencies.draftIdForSender(senderId);
    return typeof draftId === 'string' && draftId ? { draftId, senderId } : null;
  }

  async function respond<Schema extends z.ZodTypeAny>(
    event: IpcMainInvokeEvent,
    schema: Schema,
    action: (draftId: string, senderId: number) => unknown,
  ): Promise<z.infer<Schema> | ReviewFailure> {
    const authorized = authorize(event);
    if (!authorized) return FORBIDDEN;
    let result: unknown;
    try {
      result = await action(authorized.draftId, authorized.senderId);
    } catch {
      return UNAVAILABLE;
    }
    // Nothing beyond the declared shape crosses to the renderer, even if the
    // service grows a field the protocol has not admitted.
    const response = schema.safeParse(result);
    return response.success ? response.data : UNAVAILABLE;
  }

  const withArtifactId = <Schema extends z.ZodTypeAny>(
    event: IpcMainInvokeEvent,
    schema: Schema,
    artifactId: unknown,
    action: (draftId: string, senderId: number, id: string) => unknown,
  ) => {
    const request = bugReportArtifactIdSchema.safeParse(artifactId);
    if (!request.success) return Promise.resolve(INVALID_REQUEST);
    return respond(event, schema, (draftId, senderId) =>
      action(draftId, senderId, request.data),
    );
  };

  const handlers: BugReportReviewHandlers = {
    discard: (event) =>
      respond(event, bugReportDiscardResponseSchema, (draftId, senderId) =>
        bugReports.discardDraft(draftId, senderId),
      ),
    excludeArtifact: (event, artifactId) =>
      withArtifactId(event, bugReportReviewDraftResponseSchema, artifactId, (draftId, senderId, id) =>
        bugReports.excludeArtifact(draftId, senderId, id),
      ),
    get: (event) =>
      respond(event, bugReportReviewDraftResponseSchema, (draftId, senderId) =>
        bugReports.getReview(draftId, senderId),
      ),
    getArtifactPreview: (event, artifactId) =>
      withArtifactId(
        event,
        bugReportArtifactPreviewResponseSchema,
        artifactId,
        (draftId, senderId, id) => bugReports.getArtifactPreview(draftId, senderId, id),
      ),
    includeArtifact: (event, artifactId) =>
      withArtifactId(event, bugReportReviewDraftResponseSchema, artifactId, (draftId, senderId, id) =>
        bugReports.includeArtifact(draftId, senderId, id),
      ),
    openGitHub: (event) =>
      respond(event, bugReportOpenGitHubResponseSchema, (draftId, senderId) => {
        const claimed = bugReports.claimApprovedReport(draftId, senderId);
        return claimed.ok ? dependencies.openPreparedReport(claimed.snapshot) : claimed;
      }),
    prepare: (event) =>
      respond(event, bugReportPrepareResponseSchema, async (draftId, senderId) => {
        const approved = bugReports.approveDraft(draftId, senderId);
        if (!approved.ok) return approved;
        const claimed = bugReports.claimApprovedReport(draftId, senderId);
        if (!claimed.ok) return claimed;
        const handoff = await dependencies.prepareApprovedReport(claimed.snapshot);
        // A failed handoff still names the approved report so the window can
        // retry materialization instead of asking for a fresh approval.
        return handoff.ok
          ? { ok: true, prepared: handoff.prepared, report: claimed.report }
          : { ...handoff, report: claimed.report };
      }),
    reopen: (event) =>
      respond(event, bugReportReviewDraftResponseSchema, (draftId, senderId) =>
        bugReports.reopenReview(draftId, senderId),
      ),
    saveArtifacts: (event) =>
      respond(event, bugReportSaveArtifactsResponseSchema, (draftId, senderId) => {
        const claimed = bugReports.claimApprovedReport(draftId, senderId);
        return claimed.ok ? dependencies.savePreparedReport(claimed.snapshot) : claimed;
      }),
    updateDescription: (event, description) => {
      const request = bugReportDescriptionSchema.safeParse(description);
      if (!request.success) return Promise.resolve(INVALID_REQUEST);
      return respond(event, bugReportReviewDraftResponseSchema, (draftId, senderId) =>
        bugReports.updateDescription(draftId, senderId, request.data),
      );
    },
  };
  return Object.freeze(handlers);
}

export function registerBugReportReviewIpc(
  dependencies: BugReportReviewDependencies,
): BugReportReviewHandlers {
  const handlers = createBugReportReviewIpcHandlers(dependencies);
  dependencies.ipcMain.handle(BUG_REPORT_REVIEW_CHANNEL.GET, handlers.get);
  dependencies.ipcMain.handle(
    BUG_REPORT_REVIEW_CHANNEL.GET_ARTIFACT_PREVIEW,
    handlers.getArtifactPreview,
  );
  dependencies.ipcMain.handle(
    BUG_REPORT_REVIEW_CHANNEL.UPDATE_DESCRIPTION,
    handlers.updateDescription,
  );
  dependencies.ipcMain.handle(BUG_REPORT_REVIEW_CHANNEL.INCLUDE_ARTIFACT, handlers.includeArtifact);
  dependencies.ipcMain.handle(BUG_REPORT_REVIEW_CHANNEL.EXCLUDE_ARTIFACT, handlers.excludeArtifact);
  dependencies.ipcMain.handle(BUG_REPORT_REVIEW_CHANNEL.PREPARE, handlers.prepare);
  dependencies.ipcMain.handle(BUG_REPORT_REVIEW_CHANNEL.REOPEN, handlers.reopen);
  dependencies.ipcMain.handle(BUG_REPORT_REVIEW_CHANNEL.OPEN_GITHUB, handlers.openGitHub);
  dependencies.ipcMain.handle(BUG_REPORT_REVIEW_CHANNEL.SAVE_ARTIFACTS, handlers.saveArtifacts);
  dependencies.ipcMain.handle(BUG_REPORT_REVIEW_CHANNEL.DISCARD, handlers.discard);
  return handlers;
}
