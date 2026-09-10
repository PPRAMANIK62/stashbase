import type {
  ApprovedReport,
  ArtifactPreview,
  ReviewDescription,
  ReviewDraft,
  ReviewFailure,
  ReviewFailureExtra,
} from '@/features/bug-report/domain/review-session';
import { featureErrorClass, type FeatureError } from '@/shared/domain/feature-error';

/** What main holds for this window when it asks: a draft still under review,
 *  or one it already approved. */
export type ReviewSnapshot =
  | { readonly kind: 'reviewing'; readonly draft: ReviewDraft }
  | { readonly kind: 'approved'; readonly report: ApprovedReport };

/** Approval and materialization are one request. `approved-unprepared` is a
 *  snapshot main froze whose files it could not write; the window offers the
 *  idempotent retry rather than a fresh approval. */
export type PrepareOutcome =
  | { readonly kind: 'prepared'; readonly artifactCount: number; readonly report: ApprovedReport }
  | {
      readonly kind: 'approved-unprepared';
      readonly failure: ReviewFailure;
      readonly report: ApprovedReport;
    };

/** Every call resolves the draft from this window's sender, so none names
 *  one. Counts answer how many files a handoff placed in Downloads. */
export interface BugReportReviewPort {
  discard(): Promise<void>;
  excludeArtifact(artifactId: string): Promise<ReviewDraft>;
  get(): Promise<ReviewSnapshot>;
  getArtifactPreview(artifactId: string): Promise<ArtifactPreview>;
  includeArtifact(artifactId: string): Promise<ReviewDraft>;
  openGitHub(): Promise<number>;
  prepare(): Promise<PrepareOutcome>;
  reopen(): Promise<ReviewDraft>;
  saveArtifacts(): Promise<number>;
  updateDescription(description: ReviewDescription): Promise<ReviewDraft>;
}

export type BugReportError = FeatureError<ReviewFailureExtra>;
export const BugReportError = featureErrorClass<ReviewFailureExtra>('BugReportError');
