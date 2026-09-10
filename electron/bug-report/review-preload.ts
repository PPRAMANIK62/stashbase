import type { z } from 'zod';

import {
  BUG_REPORT_REVIEW_CHANNEL,
  type BugReportArtifactPreviewResponse,
  type BugReportDescription,
  type BugReportDiscardResponse,
  type BugReportOpenGitHubResponse,
  type BugReportPrepareResponse,
  type BugReportReviewDraftResponse,
  type BugReportSaveArtifactsResponse,
  bugReportArtifactIdSchema,
  bugReportArtifactPreviewResponseSchema,
  bugReportDescriptionSchema,
  bugReportDiscardResponseSchema,
  bugReportOpenGitHubResponseSchema,
  bugReportPrepareResponseSchema,
  bugReportReviewDraftResponseSchema,
  bugReportSaveArtifactsResponseSchema,
} from '../../shared/protocols/electron/bug-report-review.ts';

export interface IpcRenderer {
  invoke(channel: string, payload?: unknown): Promise<unknown>;
}

export interface BugReportReviewBridge {
  discard(): Promise<BugReportDiscardResponse>;
  excludeArtifact(artifactId: string): Promise<BugReportReviewDraftResponse>;
  get(): Promise<BugReportReviewDraftResponse>;
  getArtifactPreview(artifactId: string): Promise<BugReportArtifactPreviewResponse>;
  includeArtifact(artifactId: string): Promise<BugReportReviewDraftResponse>;
  openGitHub(): Promise<BugReportOpenGitHubResponse>;
  prepare(): Promise<BugReportPrepareResponse>;
  reopen(): Promise<BugReportReviewDraftResponse>;
  saveArtifacts(): Promise<BugReportSaveArtifactsResponse>;
  updateDescription(description: BugReportDescription): Promise<BugReportReviewDraftResponse>;
}

/** The failure branch every review response shares, so one envelope answers
 *  any channel the bridge could not complete. */
interface ReviewFailure {
  error: { code: 'INVALID_REQUEST' | 'UNAVAILABLE'; message: string };
  ok: false;
}

const invalidRequest = (): ReviewFailure => ({
  error: { code: 'INVALID_REQUEST', message: 'The bug report request was invalid.' },
  ok: false,
});

const unavailable = (): ReviewFailure => ({
  error: { code: 'UNAVAILABLE', message: 'The bug report review returned an invalid response.' },
  ok: false,
});

async function call<Schema extends z.ZodTypeAny>(
  ipcRenderer: IpcRenderer,
  channel: string,
  schema: Schema,
  payload?: unknown,
): Promise<z.infer<Schema> | ReviewFailure> {
  try {
    const response = schema.safeParse(await ipcRenderer.invoke(channel, payload));
    return response.success ? response.data : unavailable();
  } catch {
    return unavailable();
  }
}

export function createBugReportReviewPreload(ipcRenderer: IpcRenderer): BugReportReviewBridge {
  const withArtifactId = async (channel: string, artifactId: string) => {
    const request = bugReportArtifactIdSchema.safeParse(artifactId);
    if (!request.success) return invalidRequest();
    return call(ipcRenderer, channel, bugReportReviewDraftResponseSchema, request.data);
  };

  return Object.freeze({
    discard: () =>
      call(ipcRenderer, BUG_REPORT_REVIEW_CHANNEL.DISCARD, bugReportDiscardResponseSchema),
    excludeArtifact: (artifactId: string) =>
      withArtifactId(BUG_REPORT_REVIEW_CHANNEL.EXCLUDE_ARTIFACT, artifactId),
    get: () => call(ipcRenderer, BUG_REPORT_REVIEW_CHANNEL.GET, bugReportReviewDraftResponseSchema),
    async getArtifactPreview(artifactId: string) {
      const request = bugReportArtifactIdSchema.safeParse(artifactId);
      if (!request.success) return invalidRequest();
      return call(
        ipcRenderer,
        BUG_REPORT_REVIEW_CHANNEL.GET_ARTIFACT_PREVIEW,
        bugReportArtifactPreviewResponseSchema,
        request.data,
      );
    },
    includeArtifact: (artifactId: string) =>
      withArtifactId(BUG_REPORT_REVIEW_CHANNEL.INCLUDE_ARTIFACT, artifactId),
    openGitHub: () =>
      call(ipcRenderer, BUG_REPORT_REVIEW_CHANNEL.OPEN_GITHUB, bugReportOpenGitHubResponseSchema),
    prepare: () =>
      call(ipcRenderer, BUG_REPORT_REVIEW_CHANNEL.PREPARE, bugReportPrepareResponseSchema),
    reopen: () =>
      call(ipcRenderer, BUG_REPORT_REVIEW_CHANNEL.REOPEN, bugReportReviewDraftResponseSchema),
    saveArtifacts: () =>
      call(
        ipcRenderer,
        BUG_REPORT_REVIEW_CHANNEL.SAVE_ARTIFACTS,
        bugReportSaveArtifactsResponseSchema,
      ),
    async updateDescription(description: BugReportDescription) {
      const request = bugReportDescriptionSchema.safeParse(description);
      if (!request.success) return invalidRequest();
      return call(
        ipcRenderer,
        BUG_REPORT_REVIEW_CHANNEL.UPDATE_DESCRIPTION,
        bugReportReviewDraftResponseSchema,
        request.data,
      );
    },
  });
}
