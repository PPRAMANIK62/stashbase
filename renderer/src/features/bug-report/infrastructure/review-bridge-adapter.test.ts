import { describe, expect, it } from 'vite-plus/test';

import { BugReportError } from '@/features/bug-report/application/ports';
import type { BugReportReviewBridge } from '@/platform/electron/bug-report-review';
import {
  bugReportReviewModelSchema,
  type BugReportApprovedReport,
  type BugReportReviewModel,
} from '@/protocols/electron/bug-report-review';

import { createBugReportReviewAdapter, failureKind } from './review-bridge-adapter';

const report: BugReportApprovedReport = {
  approvedAt: '2026-03-04T10:00:00.000Z',
  artifacts: [{ id: 'shot', kind: 'screenshot' }],
  description: { problem: 'Save failed', reproduction: '' },
  state: 'approved',
};

/** A representative safe review model, parsed so the fixture is one the
 *  preload would actually hand over. */
const model: BugReportReviewModel = bugReportReviewModelSchema.parse({
  approval: null,
  artifacts: [
    {
      available: true,
      id: 'shot',
      included: true,
      kind: 'screenshot',
      summary: { byteLength: 2048, height: 600, mimeType: 'image/png', width: 800 },
    },
    {
      available: true,
      id: 'log',
      included: false,
      kind: 'log',
      summary: { byteLength: 512, redactionCount: 1, truncated: true },
    },
    { available: false, id: 'diag', included: false, kind: 'diagnostics' },
  ],
  createdAt: '2026-03-04T09:58:00.000Z',
  description: { problem: 'Save failed', reproduction: '' },
  state: 'reviewing',
  updatedAt: '2026-03-04T09:59:00.000Z',
});

const refused = { error: { code: 'NOT_FOUND' as const, message: 'gone' }, ok: false as const };

function bridge(overrides: Partial<BugReportReviewBridge> = {}): BugReportReviewBridge {
  const draft = async () => ({ draft: model, ok: true as const });
  return {
    discard: async () => ({ ok: true as const }),
    excludeArtifact: draft,
    get: draft,
    getArtifactPreview: async () => ({
      ok: true as const,
      preview: {
        byteLength: 512,
        kind: 'log' as const,
        redactionCount: 1,
        text: 'sanitized',
        truncated: true,
      },
    }),
    includeArtifact: draft,
    openGitHub: async () => ({ ok: true as const, prepared: { artifactCount: 2 } }),
    prepare: async () => ({ ok: true as const, prepared: { artifactCount: 1 }, report }),
    reopen: draft,
    saveArtifacts: async () => ({ ok: true as const, saved: { artifactCount: 2 } }),
    updateDescription: draft,
    ...overrides,
  };
}

describe('bug report review bridge adapter', () => {
  it('maps the safe review model to the draft, keeping unavailable rows visible', async () => {
    const snapshot = await createBugReportReviewAdapter(bridge()).get();
    expect(snapshot).toEqual({
      draft: {
        artifacts: [
          {
            availability: {
              included: true,
              kind: 'available',
              summary: { byteLength: 2048, height: 600, kind: 'screenshot', width: 800 },
            },
            id: 'shot',
            kind: 'screenshot',
          },
          {
            availability: {
              included: false,
              kind: 'available',
              summary: { byteLength: 512, kind: 'log', redactionCount: 1, truncated: true },
            },
            id: 'log',
            kind: 'log',
          },
          { availability: { kind: 'unavailable' }, id: 'diag', kind: 'diagnostics' },
        ],
        description: { problem: 'Save failed', reproduction: '' },
      },
      kind: 'reviewing',
    });
  });

  it('reads an already approved draft as the approval main holds', async () => {
    const adapter = createBugReportReviewAdapter(
      bridge({
        get: async () => ({ draft: { ...model, approval: report, state: 'approved' }, ok: true }),
      }),
    );
    await expect(adapter.get()).resolves.toEqual({
      kind: 'approved',
      report: {
        approvedAt: report.approvedAt,
        artifacts: report.artifacts,
        description: report.description,
      },
    });
  });

  it('maps every preview kind', async () => {
    const adapter = createBugReportReviewAdapter(bridge());
    await expect(adapter.getArtifactPreview('log')).resolves.toEqual({
      byteLength: 512,
      kind: 'log',
      redactionCount: 1,
      text: 'sanitized',
      truncated: true,
    });
    const details = {
      appName: 'StashBase',
      appVersion: '1.0.0',
      architecture: 'arm64',
      capturedAt: '2026-03-04T09:58:00.000Z',
      electronVersion: '37.0.0',
      mode: 'Packaged' as const,
      platform: 'darwin',
      platformRelease: '24.0.0',
    };
    const diagnostics = createBugReportReviewAdapter(
      bridge({
        getArtifactPreview: async () => ({ ok: true, preview: { details, kind: 'diagnostics' } }),
      }),
    );
    await expect(diagnostics.getArtifactPreview('diag')).resolves.toEqual({
      details,
      kind: 'diagnostics',
    });
    const screenshot = createBugReportReviewAdapter(
      bridge({
        getArtifactPreview: async () => ({
          ok: true,
          preview: {
            byteLength: 8,
            dataUrl: 'data:image/png;base64,AAAA',
            height: 2,
            kind: 'screenshot',
            mimeType: 'image/png',
            width: 2,
          },
        }),
      }),
    );
    await expect(screenshot.getArtifactPreview('shot')).resolves.toEqual({
      byteLength: 8,
      dataUrl: 'data:image/png;base64,AAAA',
      height: 2,
      kind: 'screenshot',
      width: 2,
    });
  });

  it('answers prepare with the approval, and with the retryable case when only the files failed', async () => {
    await expect(createBugReportReviewAdapter(bridge()).prepare()).resolves.toMatchObject({
      artifactCount: 1,
      kind: 'prepared',
      report: { approvedAt: report.approvedAt },
    });

    const unprepared = createBugReportReviewAdapter(
      bridge({
        prepare: async () => ({
          error: { code: 'PREPARE_FAILED', message: 'disk full' },
          ok: false,
          report,
        }),
      }),
    );
    await expect(unprepared.prepare()).resolves.toEqual({
      failure: { kind: 'prepare-failed' },
      kind: 'approved-unprepared',
      report: {
        approvedAt: report.approvedAt,
        artifacts: report.artifacts,
        description: report.description,
      },
    });

    const refusedPrepare = createBugReportReviewAdapter(
      bridge({
        prepare: async () => ({
          error: { code: 'PRIVACY_CHECK_FAILED', message: 'secret' },
          ok: false,
        }),
      }),
    );
    await expect(refusedPrepare.prepare()).rejects.toMatchObject({
      kind: 'privacy',
      name: 'BugReportError',
    });
  });

  it('returns handoff counts and throws a classified refusal otherwise', async () => {
    const adapter = createBugReportReviewAdapter(bridge());
    await expect(adapter.openGitHub()).resolves.toBe(2);
    await expect(adapter.saveArtifacts()).resolves.toBe(2);
    await expect(adapter.discard()).resolves.toBeUndefined();
    await expect(
      adapter.updateDescription({ problem: 'x', reproduction: '' }),
    ).resolves.toMatchObject({
      description: { problem: 'Save failed' },
    });

    const gone = createBugReportReviewAdapter(
      bridge({
        discard: async () => refused,
        includeArtifact: async () => refused,
        reopen: async () => refused,
      }),
    );
    await expect(gone.discard()).rejects.toBeInstanceOf(BugReportError);
    await expect(gone.includeArtifact('log')).rejects.toMatchObject({ kind: 'draft-gone' });
    await expect(gone.reopen()).rejects.toMatchObject({ kind: 'draft-gone' });
  });

  it('maps every wire code onto the failure ladder', () => {
    expect(failureKind('FORBIDDEN')).toBe('unauthorized');
    expect(failureKind('INVALID_STATE')).toBe('wrong-state');
    expect(failureKind('INVALID_DESCRIPTION')).toBe('description-invalid');
    expect(failureKind('ARTIFACT_UNAVAILABLE')).toBe('artifact-unavailable');
    expect(failureKind('DOWNLOADS_FAILED')).toBe('downloads-failed');
    expect(failureKind('GITHUB_OPEN_FAILED')).toBe('github-open-failed');
    expect(failureKind('UNAVAILABLE')).toBe('unavailable');
    expect(failureKind('INVALID_REQUEST')).toBe('invalid-response');
  });
});
