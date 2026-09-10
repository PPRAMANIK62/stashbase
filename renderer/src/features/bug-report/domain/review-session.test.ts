import { describe, expect, it } from 'vite-plus/test';

import {
  initialReviewSession,
  reduceReviewSession as reduce,
  sessionGeneration,
  type ApprovedReport,
  type ReviewDraft,
  type ReviewEvent,
  type ReviewSession,
} from './review-session';

const draft: ReviewDraft = {
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
        summary: { byteLength: 512, kind: 'log', redactionCount: 1, truncated: false },
      },
      id: 'log',
      kind: 'log',
    },
    { availability: { kind: 'unavailable' }, id: 'diag', kind: 'diagnostics' },
  ],
  description: { problem: 'Save failed', reproduction: '' },
};

const report: ApprovedReport = {
  approvedAt: '2026-01-01T00:00:00.000Z',
  artifacts: [{ id: 'shot', kind: 'screenshot' }],
  description: draft.description,
};

const failure = { kind: 'unavailable' as const };

function play(events: ReviewEvent[], from: ReviewSession = initialReviewSession): ReviewSession {
  return events.reduce(reduce, from);
}

const loaded = () => play([{ draft, type: 'loaded' }]);
const readyPrepared = () =>
  play(
    [
      { generation: 1, type: 'prepare-started' },
      { generation: 1, report, type: 'prepared' },
    ],
    loaded(),
  );

describe('review session reducer', () => {
  it('loads into reviewing, an approved draft into ready, and a refusal into unavailable', () => {
    expect(loaded()).toMatchObject({
      dirty: false,
      generation: 1,
      kind: 'reviewing',
      previews: {},
    });
    expect(play([{ report, type: 'loaded-approved' }])).toMatchObject({
      handoff: { kind: 'unprepared' },
      kind: 'ready',
      report,
    });
    expect(play([{ failure, type: 'load-failed' }])).toEqual({ failure, kind: 'unavailable' });
    expect(reduce({ failure, kind: 'unavailable' }, { draft, type: 'loaded' }).kind).toBe(
      'unavailable',
    );
    expect(sessionGeneration(initialReviewSession)).toBeNull();
    expect(sessionGeneration(loaded())).toBe(1);
  });

  it('tracks an edit as dirty until main confirms it', () => {
    const edited = play(
      [
        {
          description: { problem: 'Save failed twice', reproduction: '1. Save' },
          generation: 1,
          type: 'description-edited',
        },
        { generation: 1, type: 'description-commit-started' },
      ],
      loaded(),
    );
    expect(edited).toMatchObject({
      dirty: false,
      draft: { description: { problem: 'Save failed twice' } },
      pending: { kind: 'description' },
    });
    const committed = reduce(edited, { draft, generation: 1, type: 'description-committed' });
    expect(committed).toMatchObject({
      dirty: false,
      draft,
      notice: { kind: 'description-updated' },
      pending: null,
    });

    const editedMeanwhile = reduce(edited, {
      description: { problem: 'Save failed three times', reproduction: '' },
      generation: 1,
      type: 'description-edited',
    });
    expect(
      reduce(editedMeanwhile, { draft, generation: 1, type: 'description-committed' }),
    ).toMatchObject({
      dirty: true,
      draft: { artifacts: draft.artifacts, description: { problem: 'Save failed three times' } },
      pending: null,
    });
    expect(reduce(edited, { failure, generation: 1, type: 'command-failed' })).toMatchObject({
      dirty: true,
      pending: null,
    });
  });

  it('applies a selection through main and reports it', () => {
    const started = reduce(loaded(), {
      artifactId: 'log',
      generation: 1,
      included: true,
      type: 'selection-started',
    });
    expect(started).toMatchObject({
      pending: { artifactId: 'log', included: true, kind: 'selection' },
    });
    const applied = reduce(started, {
      artifact: 'log',
      draft,
      generation: 1,
      included: true,
      type: 'selection-applied',
    });
    expect(applied).toMatchObject({
      notice: { artifact: 'log', included: true, kind: 'selection-updated' },
      pending: null,
    });
    expect(reduce(started, { failure, generation: 1, type: 'command-failed' })).toMatchObject({
      notice: { failure, kind: 'failed' },
      pending: null,
    });
  });

  it('opens one preview at a time, loads it once, and never touches inclusion', () => {
    const opened = reduce(loaded(), { artifactId: 'log', generation: 1, type: 'preview-toggled' });
    expect(opened).toMatchObject({ openPreviewId: 'log', previews: { log: { kind: 'loading' } } });
    const preview = {
      byteLength: 5,
      kind: 'log' as const,
      redactionCount: 0,
      text: 'hello',
      truncated: false,
    };
    const loadedPreview = reduce(opened, {
      artifactId: 'log',
      generation: 1,
      preview,
      type: 'preview-loaded',
    });
    expect(loadedPreview).toMatchObject({ previews: { log: { kind: 'loaded', preview } } });

    const closed = reduce(loadedPreview, {
      artifactId: 'log',
      generation: 1,
      type: 'preview-toggled',
    });
    expect(closed).toMatchObject({ openPreviewId: null, previews: { log: { kind: 'loaded' } } });
    const reopened = reduce(closed, { artifactId: 'log', generation: 1, type: 'preview-toggled' });
    expect(reopened).toMatchObject({ openPreviewId: 'log', previews: { log: { kind: 'loaded' } } });

    const switched = reduce(reopened, {
      artifactId: 'shot',
      generation: 1,
      type: 'preview-toggled',
    });
    expect(switched).toMatchObject({
      openPreviewId: 'shot',
      previews: { shot: { kind: 'loading' } },
    });
    const failed = reduce(switched, {
      artifactId: 'shot',
      failure,
      generation: 1,
      type: 'preview-failed',
    });
    expect(failed).toMatchObject({ previews: { shot: { failure, kind: 'failed' } } });

    for (const state of [opened, loadedPreview, closed, reopened, switched, failed]) {
      expect(state.kind === 'reviewing' && state.draft.artifacts).toEqual(draft.artifacts);
    }
  });

  it('locks the form while preparing and returns to it, previews intact, when preparation fails', () => {
    const withPreview = reduce(loaded(), {
      artifactId: 'log',
      generation: 1,
      type: 'preview-toggled',
    });
    const preparing = reduce(withPreview, { generation: 1, type: 'prepare-started' });
    expect(preparing).toMatchObject({ kind: 'preparing', openPreviewId: 'log' });
    expect(
      reduce(preparing, {
        artifactId: 'shot',
        generation: 1,
        type: 'preview-toggled',
      }),
    ).toBe(preparing);

    const failed = reduce(preparing, { failure, generation: 1, type: 'prepare-failed' });
    expect(failed).toMatchObject({
      dirty: false,
      kind: 'reviewing',
      notice: { failure, kind: 'failed' },
      openPreviewId: 'log',
      previews: { log: { kind: 'loading' } },
    });
  });

  it('moves to ready on approval, with the handoff marked failed when only the files failed', () => {
    expect(readyPrepared()).toEqual({
      generation: 1,
      handoff: { kind: 'prepared' },
      kind: 'ready',
      notice: null,
      pending: null,
      report,
    });
    const preparing = reduce(loaded(), { generation: 1, type: 'prepare-started' });
    expect(
      reduce(preparing, { failure, generation: 1, report, type: 'approved-unprepared' }),
    ).toMatchObject({
      handoff: { failure, kind: 'failed' },
      kind: 'ready',
    });
  });

  it('reports each handoff action and a retry that repairs the handoff', () => {
    const started = reduce(readyPrepared(), {
      action: 'open-github',
      generation: 1,
      type: 'handoff-started',
    });
    expect(started).toMatchObject({ notice: null, pending: 'open-github' });
    expect(
      reduce(started, { generation: 1, type: 'handoff-completed', via: 'github' }),
    ).toMatchObject({
      notice: { kind: 'handoff-complete', via: 'github' },
      pending: null,
    });
    expect(reduce(started, { failure, generation: 1, type: 'command-failed' })).toMatchObject({
      notice: { failure, kind: 'failed' },
      pending: null,
    });

    const unprepared = play([{ report, type: 'loaded-approved' }]);
    const retrying = reduce(unprepared, {
      action: 'retry',
      generation: 1,
      type: 'handoff-started',
    });
    expect(reduce(retrying, { generation: 1, type: 'retry-prepared' })).toMatchObject({
      handoff: { kind: 'prepared' },
      pending: null,
    });
    expect(reduce(retrying, { failure, generation: 1, type: 'retry-failed' })).toMatchObject({
      handoff: { failure, kind: 'failed' },
      pending: null,
    });
  });

  it('reopens into a fresh review with a new generation and no approval', () => {
    const withPreview = reduce(loaded(), {
      artifactId: 'log',
      generation: 1,
      type: 'preview-toggled',
    });
    const ready = play(
      [
        { generation: 1, type: 'prepare-started' },
        { generation: 1, report, type: 'prepared' },
        { action: 'reopen', generation: 1, type: 'handoff-started' },
      ],
      withPreview,
    );
    const reopened = reduce(ready, { draft, generation: 1, type: 'reopened' });
    expect(reopened).toEqual({
      dirty: false,
      draft,
      generation: 2,
      kind: 'reviewing',
      notice: null,
      openPreviewId: null,
      pending: null,
      previews: {},
    });
  });

  it('ignores any event stamped with a stale generation', () => {
    const reopened = play(
      [
        { generation: 1, type: 'prepare-started' },
        { generation: 1, report, type: 'prepared' },
        { draft, generation: 1, type: 'reopened' },
      ],
      loaded(),
    );
    expect(sessionGeneration(reopened)).toBe(2);
    expect(reduce(reopened, { generation: 1, type: 'prepare-started' })).toBe(reopened);
    expect(reduce(reopened, { artifactId: 'log', generation: 1, type: 'preview-toggled' })).toBe(
      reopened,
    );
    expect(reduce(initialReviewSession, { generation: 1, type: 'prepare-started' })).toBe(
      initialReviewSession,
    );
  });

  it('closes from anywhere and stays closed', () => {
    const closed = reduce(loaded(), { type: 'closed' });
    expect(closed).toEqual({ kind: 'closed' });
    expect(reduce(readyPrepared(), { type: 'closed' })).toEqual({ kind: 'closed' });
    expect(reduce(closed, { draft, type: 'loaded' })).toBe(closed);
    expect(reduce(closed, { generation: 1, type: 'prepare-started' })).toBe(closed);
    expect(reduce(closed, { type: 'closed' })).toBe(closed);
  });
});
