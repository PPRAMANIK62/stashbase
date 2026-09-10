/**
 * The review port over the window's preload bridge.
 *
 * The preload has already validated every envelope against the wire schema,
 * so this adapter only maps: the safe review model to the session's draft,
 * previews to their domain shape, and main's error codes to the failure
 * ladder the view selects a sentence by. A refused call throws
 * `BugReportError`; nothing here reads an error's message.
 */
import { BugReportError, type BugReportReviewPort } from '@/features/bug-report/application/ports';
import type {
  ApprovedReport,
  ArtifactPreview,
  ReviewArtifact,
  ReviewDraft,
  ReviewFailureKind,
} from '@/features/bug-report/domain/review-session';
import type { BugReportReviewBridge } from '@/platform/electron/bug-report-review';
import type {
  BugReportApprovedReport,
  BugReportArtifactPreview,
  BugReportError as BugReportWireError,
  BugReportErrorCode,
  BugReportReviewArtifact,
  BugReportReviewModel,
} from '@/protocols/electron/bug-report-review';

const FAILURE_KINDS: Readonly<Record<BugReportErrorCode, ReviewFailureKind>> = {
  ARTIFACT_UNAVAILABLE: 'artifact-unavailable',
  DOWNLOADS_FAILED: 'downloads-failed',
  FORBIDDEN: 'unauthorized',
  GITHUB_OPEN_FAILED: 'github-open-failed',
  INVALID_ARTIFACT: 'artifact-unavailable',
  INVALID_DESCRIPTION: 'description-invalid',
  INVALID_DRAFT: 'draft-gone',
  INVALID_OWNER: 'draft-gone',
  INVALID_REQUEST: 'invalid-response',
  INVALID_STATE: 'wrong-state',
  NOT_FOUND: 'draft-gone',
  PREPARE_FAILED: 'prepare-failed',
  PRIVACY_CHECK_FAILED: 'privacy',
  REVIEW_ALREADY_BOUND: 'draft-gone',
  SAVE_FAILED: 'downloads-failed',
  UNAVAILABLE: 'unavailable',
};

export function failureKind(code: BugReportErrorCode): ReviewFailureKind {
  return FAILURE_KINDS[code];
}

function refusal(error: BugReportWireError): BugReportError {
  return new BugReportError(failureKind(error.code), error.message);
}

function toArtifact(artifact: BugReportReviewArtifact): ReviewArtifact {
  const base = { id: artifact.id, kind: artifact.kind };
  if (!artifact.available) return { ...base, availability: { kind: 'unavailable' } };
  const included = artifact.included;
  switch (artifact.kind) {
    case 'screenshot':
      return artifact.summary
        ? {
            ...base,
            availability: {
              included,
              kind: 'available',
              summary: {
                kind: 'screenshot',
                ...pick(artifact.summary, 'byteLength', 'height', 'width'),
              },
            },
          }
        : { ...base, availability: { kind: 'unavailable' } };
    case 'log':
      return artifact.summary
        ? {
            ...base,
            availability: {
              included,
              kind: 'available',
              summary: {
                kind: 'log',
                ...pick(artifact.summary, 'byteLength', 'redactionCount', 'truncated'),
              },
            },
          }
        : { ...base, availability: { kind: 'unavailable' } };
    case 'diagnostics':
      return {
        ...base,
        availability: { included, kind: 'available', summary: { kind: 'diagnostics' } },
      };
  }
}

function pick<Value, Key extends keyof Value>(value: Value, ...keys: Key[]): Pick<Value, Key> {
  const picked = {} as Pick<Value, Key>;
  for (const key of keys) picked[key] = value[key];
  return picked;
}

function toDraft(model: BugReportReviewModel): ReviewDraft {
  return { artifacts: model.artifacts.map(toArtifact), description: model.description };
}

function toReport(report: BugReportApprovedReport): ApprovedReport {
  return {
    approvedAt: report.approvedAt,
    artifacts: report.artifacts,
    description: report.description,
  };
}

function toPreview(preview: BugReportArtifactPreview): ArtifactPreview {
  switch (preview.kind) {
    case 'screenshot':
      return { kind: 'screenshot', ...pick(preview, 'byteLength', 'dataUrl', 'height', 'width') };
    case 'log':
      return { kind: 'log', ...pick(preview, 'byteLength', 'redactionCount', 'text', 'truncated') };
    case 'diagnostics':
      return { details: preview.details, kind: 'diagnostics' };
  }
}

export function createBugReportReviewAdapter(bridge: BugReportReviewBridge): BugReportReviewPort {
  async function draft(request: Promise<Awaited<ReturnType<BugReportReviewBridge['get']>>>) {
    const response = await request;
    if (!response.ok) throw refusal(response.error);
    return toDraft(response.draft);
  }

  return {
    async discard() {
      const response = await bridge.discard();
      if (!response.ok) throw refusal(response.error);
    },
    excludeArtifact(artifactId) {
      return draft(bridge.excludeArtifact(artifactId));
    },
    async get() {
      const response = await bridge.get();
      if (!response.ok) throw refusal(response.error);
      const model = response.draft;
      return model.state === 'approved' && model.approval
        ? { kind: 'approved', report: toReport(model.approval) }
        : { draft: toDraft(model), kind: 'reviewing' };
    },
    async getArtifactPreview(artifactId) {
      const response = await bridge.getArtifactPreview(artifactId);
      if (!response.ok) throw refusal(response.error);
      return toPreview(response.preview);
    },
    includeArtifact(artifactId) {
      return draft(bridge.includeArtifact(artifactId));
    },
    async openGitHub() {
      const response = await bridge.openGitHub();
      if (!response.ok) throw refusal(response.error);
      return response.prepared.artifactCount;
    },
    async prepare() {
      const response = await bridge.prepare();
      if (response.ok) {
        return {
          artifactCount: response.prepared.artifactCount,
          kind: 'prepared',
          report: toReport(response.report),
        };
      }
      if (response.report) {
        return {
          failure: { kind: failureKind(response.error.code) },
          kind: 'approved-unprepared',
          report: toReport(response.report),
        };
      }
      throw refusal(response.error);
    },
    reopen() {
      return draft(bridge.reopen());
    },
    async saveArtifacts() {
      const response = await bridge.saveArtifacts();
      if (!response.ok) throw refusal(response.error);
      return response.saved.artifactCount;
    },
    updateDescription(description) {
      return draft(bridge.updateDescription(description));
    },
  };
}
