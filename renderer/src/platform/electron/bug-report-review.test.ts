import { afterEach, describe, expect, it } from 'vite-plus/test';

import { isBugReportReviewBridge, readBugReportReviewBridge } from './bug-report-review';

const ok = async () => ({ ok: true as const });
const bridge = {
  discard: ok,
  excludeArtifact: ok,
  get: ok,
  getArtifactPreview: ok,
  includeArtifact: ok,
  openGitHub: ok,
  prepare: ok,
  reopen: ok,
  saveArtifacts: ok,
  updateDescription: ok,
};

afterEach(() => {
  delete window.stashbase;
});

describe('bug report review bridge', () => {
  it('recognises only the complete ten-method capability', () => {
    expect(isBugReportReviewBridge(bridge)).toBe(true);
    const { prepare: _prepare, ...partial } = bridge;
    expect(isBugReportReviewBridge(partial)).toBe(false);
    expect(isBugReportReviewBridge(null)).toBe(false);
  });

  it('reads the bridge the review preload installs and refuses anything less', () => {
    window.stashbase = { bugReportReview: bridge };
    expect(readBugReportReviewBridge()).toBe(bridge);

    window.stashbase = {};
    expect(() => readBugReportReviewBridge()).toThrow(
      'The bug report review bridge is unavailable.',
    );
    delete window.stashbase;
    expect(() => readBugReportReviewBridge()).toThrow(
      'The bug report review bridge is unavailable.',
    );
  });
});
