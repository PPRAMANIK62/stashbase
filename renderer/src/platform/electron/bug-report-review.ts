import type {
  BugReportArtifactPreviewResponse,
  BugReportDescription,
  BugReportDiscardResponse,
  BugReportOpenGitHubResponse,
  BugReportPrepareResponse,
  BugReportReviewDraftResponse,
  BugReportSaveArtifactsResponse,
} from '@/protocols/electron/bug-report-review';

/** The review window's preload capability. Every method resolves to a
 *  validated envelope and never throws; main resolves the draft from the
 *  sender, so no call names one. */
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
] as const satisfies ReadonlyArray<keyof BugReportReviewBridge>;

export function isBugReportReviewBridge(value: unknown): value is BugReportReviewBridge {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return METHODS.every((method) => typeof candidate[method] === 'function');
}

export function readBugReportReviewBridge(globalWindow: Window = window): BugReportReviewBridge {
  const bridge = globalWindow.stashbase?.bugReportReview;
  if (!isBugReportReviewBridge(bridge)) {
    throw new Error('The bug report review bridge is unavailable.');
  }
  return bridge;
}
