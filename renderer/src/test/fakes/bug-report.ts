/**
 * The bug-report review's in-memory main, shared by the feature's tests and
 * its stories: fixtures for the draft, its previews, and an approval, and a
 * port that keeps the draft and refuses on request.
 */
import type {
  BugReportReviewPort,
  PrepareOutcome,
  ReviewSnapshot,
} from '@/features/bug-report/application/ports';
import type {
  ApprovedReport,
  ArtifactPreview,
  ReviewArtifact,
  ReviewDraft,
  ReviewFailureExtra,
  ReviewFailureKind,
} from '@/features/bug-report/domain/review-session';
import { FeatureError } from '@/shared/domain/feature-error';

/** The three artifacts a review normally collects, all available; the log
 *  starts excluded so a story shows both switch positions. */
export function reviewArtifacts(): ReviewArtifact[] {
  return [
    {
      availability: {
        included: true,
        kind: 'available',
        summary: { byteLength: 184_320, height: 900, kind: 'screenshot', width: 1440 },
      },
      id: 'artifact-screenshot',
      kind: 'screenshot',
    },
    {
      availability: {
        included: false,
        kind: 'available',
        summary: { byteLength: 32_768, kind: 'log', redactionCount: 2, truncated: true },
      },
      id: 'artifact-log',
      kind: 'log',
    },
    {
      availability: { included: true, kind: 'available', summary: { kind: 'diagnostics' } },
      id: 'artifact-diagnostics',
      kind: 'diagnostics',
    },
  ];
}

export function reviewDraft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return {
    artifacts: reviewArtifacts(),
    description: { problem: '', reproduction: '' },
    ...overrides,
  };
}

export function approvedReport(draft: ReviewDraft = reviewDraft()): ApprovedReport {
  return {
    approvedAt: '2026-03-04T10:00:00.000Z',
    artifacts: draft.artifacts.flatMap((artifact) =>
      artifact.availability.kind === 'available' && artifact.availability.included
        ? [{ id: artifact.id, kind: artifact.kind }]
        : [],
    ),
    description: draft.description,
  };
}

/** A 2×2 opaque PNG: enough for an `<img>` to decode and for the zoom
 *  controls to have a real size to fit. */
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAD0lEQVQIW2NkYGD4z8DAAAAEAAEAsJYK1QAAAABJRU5ErkJggg==';

export function artifactPreviews(): Record<string, ArtifactPreview> {
  return {
    'artifact-diagnostics': {
      details: {
        appName: 'StashBase',
        appVersion: '1.4.0',
        architecture: 'arm64',
        capturedAt: '2026-03-04T09:58:00.000Z',
        electronVersion: '37.2.0',
        mode: 'Packaged',
        platform: 'darwin',
        platformRelease: '24.5.0',
      },
      kind: 'diagnostics',
    },
    'artifact-log': {
      byteLength: 32_768,
      kind: 'log',
      redactionCount: 2,
      text: '[10:57:59] save: conflict on notes/plan.md\n[10:58:00] save: retry refused',
      truncated: true,
    },
    'artifact-screenshot': {
      byteLength: 184_320,
      dataUrl: TINY_PNG,
      height: 900,
      kind: 'screenshot',
      width: 1440,
    },
  };
}

export interface FakeReviewPortOptions {
  /** What `get` answers: the draft under review, or one already approved. */
  readonly snapshot?: ReviewSnapshot;
  readonly previews?: Record<string, ArtifactPreview>;
  /** Per-call refusals, by the kind the port throws. */
  readonly refuse?: Partial<Record<keyof BugReportReviewPort, ReviewFailureKind>>;
}

export interface FakeReviewPort extends BugReportReviewPort {
  /** Every call in order, so a test can assert what reached main. */
  readonly calls: string[];
  /** The draft as main would now hold it. */
  draft: ReviewDraft;
}

/** A refusal on the bug-report ladder, built from the shared base by name so
 *  this fixture reaches no feature internals; the runtime recognises it the
 *  way it recognises the adapter's own. */
function bugReportRefusal(kind: ReviewFailureKind, message: string) {
  return new FeatureError<ReviewFailureExtra>('BugReportError', kind, message);
}

/** An in-memory main: it keeps the draft, applies selections and
 *  descriptions to it, and approves what is included. Refusals are thrown
 *  the way the real adapter throws them. */
export function bugReportReviewPort(
  { previews = artifactPreviews(), refuse = {}, snapshot }: FakeReviewPortOptions = {},
  overrides: Partial<BugReportReviewPort> = {},
): FakeReviewPort {
  const calls: string[] = [];
  const initial: ReviewSnapshot = snapshot ?? { draft: reviewDraft(), kind: 'reviewing' };
  const port: FakeReviewPort = {
    calls,
    draft: initial.kind === 'reviewing' ? initial.draft : reviewDraft(),
    async discard() {
      record('discard');
    },
    async excludeArtifact(artifactId) {
      record('excludeArtifact');
      return select(artifactId, false);
    },
    async get() {
      record('get');
      return initial;
    },
    async getArtifactPreview(artifactId) {
      record('getArtifactPreview');
      const preview = previews[artifactId];
      if (!preview) throw bugReportRefusal('artifact-unavailable', 'no preview');
      return preview;
    },
    async includeArtifact(artifactId) {
      record('includeArtifact');
      return select(artifactId, true);
    },
    async openGitHub() {
      record('openGitHub');
      return approvedReport(port.draft).artifacts.length;
    },
    async prepare() {
      record('prepare');
      const report = approvedReport(port.draft);
      const outcome: PrepareOutcome = {
        artifactCount: report.artifacts.length,
        kind: 'prepared',
        report,
      };
      return outcome;
    },
    async reopen() {
      record('reopen');
      return port.draft;
    },
    async saveArtifacts() {
      record('saveArtifacts');
      return approvedReport(port.draft).artifacts.length;
    },
    async updateDescription(description) {
      record('updateDescription');
      port.draft = { ...port.draft, description };
      return port.draft;
    },
    ...overrides,
  };

  function record(name: keyof BugReportReviewPort) {
    calls.push(name);
    const kind = refuse[name];
    if (kind) throw bugReportRefusal(kind, `${name} refused`);
  }

  function select(artifactId: string, included: boolean): ReviewDraft {
    port.draft = {
      ...port.draft,
      artifacts: port.draft.artifacts.map((artifact) =>
        artifact.id === artifactId && artifact.availability.kind === 'available'
          ? { ...artifact, availability: { ...artifact.availability, included } }
          : artifact,
      ),
    };
    return port.draft;
  }

  return port;
}
