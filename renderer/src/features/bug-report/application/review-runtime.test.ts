import { describe, expect, it, vi } from 'vite-plus/test';

import type { ArtifactPreview } from '@/features/bug-report/domain/review-session';
import { approvedReport, bugReportReviewPort } from '@/test/fakes/bug-report';

import { BugReportError } from './ports';
import { createBugReportReviewRuntime, toReviewFailure } from './review-runtime';

const noop = () => undefined;

function runtimeWith(...args: Parameters<typeof bugReportReviewPort>) {
  const port = bugReportReviewPort(...args);
  const closeWindow = vi.fn();
  const runtime = createBugReportReviewRuntime(port, { closeWindow });
  return { closeWindow, port, runtime, state: () => runtime.store.getState() };
}

describe('bug report review runtime', () => {
  it('loads the draft under review, or the approval main already holds', async () => {
    const reviewing = runtimeWith();
    await reviewing.runtime.load();
    expect(reviewing.state()).toMatchObject({ generation: 1, kind: 'reviewing' });

    const approved = runtimeWith({ snapshot: { kind: 'approved', report: approvedReport() } });
    await approved.runtime.load();
    expect(approved.state()).toMatchObject({ handoff: { kind: 'unprepared' }, kind: 'ready' });

    const gone = runtimeWith({ refuse: { get: 'draft-gone' } });
    await gone.runtime.load();
    expect(gone.state()).toEqual({ failure: { kind: 'draft-gone' }, kind: 'unavailable' });
  });

  it('commits an edited description once and reports what main confirmed', async () => {
    const { port, runtime, state } = runtimeWith();
    await runtime.load();
    runtime.editDescription({ problem: 'Save failed', reproduction: '' });
    expect(state()).toMatchObject({ dirty: true });
    await runtime.commitDescription();
    await runtime.commitDescription();
    expect(port.calls.filter((call) => call === 'updateDescription')).toHaveLength(1);
    expect(state()).toMatchObject({
      dirty: false,
      draft: { description: { problem: 'Save failed' } },
      notice: { kind: 'description-updated' },
    });
  });

  it('routes a selection through main and leaves the preview alone', async () => {
    const { port, runtime, state } = runtimeWith();
    await runtime.load();
    await runtime.togglePreview('artifact-log');
    await runtime.setIncluded('artifact-log', true);
    await runtime.setIncluded('artifact-log', true);
    expect(port.calls.filter((call) => call === 'includeArtifact')).toHaveLength(1);
    expect(state()).toMatchObject({
      notice: { artifact: 'log', included: true, kind: 'selection-updated' },
      openPreviewId: 'artifact-log',
      previews: { 'artifact-log': { kind: 'loaded' } },
    });
    await runtime.setIncluded('artifact-log', false);
    expect(port.calls.at(-1)).toBe('excludeArtifact');
    expect(state()).toMatchObject({ notice: { included: false, kind: 'selection-updated' } });
  });

  it('loads a preview once and keeps a failed one as failed', async () => {
    const { port, runtime, state } = runtimeWith({ previews: {} });
    await runtime.load();
    await runtime.togglePreview('artifact-log');
    expect(state()).toMatchObject({
      previews: { 'artifact-log': { failure: { kind: 'artifact-unavailable' }, kind: 'failed' } },
    });
    await runtime.togglePreview('artifact-log');
    await runtime.togglePreview('artifact-log');
    expect(port.calls.filter((call) => call === 'getArtifactPreview')).toHaveLength(1);
  });

  it('commits a dirty description before approving, and stops when the commit is refused', async () => {
    const { port, runtime, state } = runtimeWith();
    await runtime.load();
    runtime.editDescription({ problem: 'Save failed', reproduction: '1. Save' });
    await runtime.prepare();
    expect(port.calls.slice(1)).toEqual(['updateDescription', 'prepare']);
    expect(state()).toMatchObject({
      handoff: { kind: 'prepared' },
      kind: 'ready',
      report: { description: { problem: 'Save failed' } },
    });

    const refused = runtimeWith({ refuse: { updateDescription: 'description-invalid' } });
    await refused.runtime.load();
    refused.runtime.editDescription({ problem: 'x', reproduction: '' });
    await refused.runtime.prepare();
    expect(refused.port.calls).not.toContain('prepare');
    expect(refused.state()).toMatchObject({
      dirty: true,
      kind: 'reviewing',
      notice: { failure: { kind: 'description-invalid' }, kind: 'failed' },
    });
  });

  it('returns to the form when preparation fails, and to ready-with-retry when only the files did', async () => {
    const failed = runtimeWith({ refuse: { prepare: 'privacy' } });
    await failed.runtime.load();
    await failed.runtime.prepare();
    expect(failed.state()).toMatchObject({
      kind: 'reviewing',
      notice: { failure: { kind: 'privacy' }, kind: 'failed' },
    });

    const report = approvedReport();
    const unprepared = runtimeWith(
      {},
      {
        prepare: async () => ({
          failure: { kind: 'prepare-failed' },
          kind: 'approved-unprepared',
          report,
        }),
      },
    );
    await unprepared.runtime.load();
    await unprepared.runtime.prepare();
    expect(unprepared.state()).toMatchObject({
      handoff: { failure: { kind: 'prepare-failed' }, kind: 'failed' },
      kind: 'ready',
    });

    let attempts = 0;
    const retried = runtimeWith(
      { snapshot: { kind: 'approved', report } },
      {
        prepare: async () => {
          attempts += 1;
          if (attempts === 1) throw new BugReportError('downloads-failed', 'disk');
          return { artifactCount: 1, kind: 'prepared', report };
        },
      },
    );
    await retried.runtime.load();
    await retried.runtime.retryPrepare();
    expect(retried.state()).toMatchObject({
      handoff: { failure: { kind: 'downloads-failed' }, kind: 'failed' },
    });
    await retried.runtime.retryPrepare();
    expect(retried.state()).toMatchObject({ handoff: { kind: 'prepared' }, pending: null });
  });

  it('hands off to GitHub or Downloads and reports the destination', async () => {
    const { port, runtime, state } = runtimeWith();
    await runtime.load();
    await runtime.prepare();
    await runtime.openGitHub();
    expect(state()).toMatchObject({ notice: { kind: 'handoff-complete', via: 'github' } });
    await runtime.download();
    expect(state()).toMatchObject({ notice: { kind: 'handoff-complete', via: 'download' } });
    expect(port.calls.slice(-2)).toEqual(['openGitHub', 'saveArtifacts']);

    const refused = runtimeWith({ refuse: { openGitHub: 'github-open-failed' } });
    await refused.runtime.load();
    await refused.runtime.prepare();
    await refused.runtime.openGitHub();
    expect(refused.state()).toMatchObject({
      notice: { failure: { kind: 'github-open-failed' }, kind: 'failed' },
      pending: null,
    });
  });

  it('reopens into a fresh generation and drops a completion from the old one', async () => {
    const { runtime, state } = runtimeWith();
    await runtime.load();
    await runtime.togglePreview('artifact-log');
    await runtime.prepare();
    await runtime.reopen();
    expect(state()).toMatchObject({ generation: 2, kind: 'reviewing', previews: {} });

    const stale = runtimeWith();
    let resolvePreview: (preview: ArtifactPreview) => void = noop;
    stale.port.getArtifactPreview = () =>
      new Promise((resolve) => {
        resolvePreview = resolve;
      });
    await stale.runtime.load();
    const pending = stale.runtime.togglePreview('artifact-log');
    await stale.runtime.prepare();
    await stale.runtime.reopen();
    resolvePreview({
      byteLength: 1,
      kind: 'log',
      redactionCount: 0,
      text: 'late',
      truncated: false,
    });
    await pending;
    expect(stale.state()).toMatchObject({ generation: 2, previews: {} });
  });

  it('discards on close only while the draft is still under review', async () => {
    const reviewing = runtimeWith();
    await reviewing.runtime.load();
    await reviewing.runtime.close();
    expect(reviewing.port.calls).toContain('discard');
    expect(reviewing.closeWindow).toHaveBeenCalledOnce();
    expect(reviewing.state()).toEqual({ kind: 'closed' });

    const ready = runtimeWith();
    await ready.runtime.load();
    await ready.runtime.prepare();
    await ready.runtime.close();
    expect(ready.port.calls).not.toContain('discard');
    expect(ready.closeWindow).toHaveBeenCalledOnce();

    const refused = runtimeWith({ refuse: { discard: 'draft-gone' } });
    await refused.runtime.load();
    await refused.runtime.close();
    expect(refused.closeWindow).toHaveBeenCalledOnce();
  });

  it('reads a thrown value as its failure kind, or as unavailable', () => {
    expect(toReviewFailure(new BugReportError('privacy', 'x'))).toEqual({ kind: 'privacy' });
    expect(toReviewFailure(new Error('boom'))).toEqual({ kind: 'unavailable' });
  });
});
