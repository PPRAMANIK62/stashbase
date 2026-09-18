import { describe, expect, it } from 'vite-plus/test';

import {
  agentScopesEqual,
  agentSessionIsBlank,
  createAgentSessionState,
  scopeForWindowFolder,
  scopeLabel,
  transitionAgentSession,
} from './session';

const suggestion = {
  id: 'tool-1',
  input: { arguments: { content: '# Plan', path: '/project/Research/plan.md' } },
  kind: 'tool-started' as const,
  name: 'mcp__stashbase__suggest_edits',
};

/** The host's own answers, which are what the card is built from. It refuses a
 *  proposal matching the document without erroring, so the two have to be told
 *  apart by reading them. */
const PARKED = JSON.stringify({
  id: 'proposal-1',
  baseVersion: 'sha256:v1',
  message: 'Parked for review.',
  parked: true,
  path: '/project/Research/plan.md',
});
const UNCHANGED = JSON.stringify({
  message: 'The proposal matches the file on disk.',
  parked: false,
  path: '/project/Research/plan.md',
  reason: 'no-changes',
});

describe('Agent session domain', () => {
  it('parks a revision block for a settled suggestion and none for a failed one', () => {
    const session = createAgentSessionState({
      agent: 'stashbase',
      id: 'chat-1',
      scope: { kind: 'folder', path: '/project/Research' },
    });
    const started = transitionAgentSession(session, suggestion);
    const settled = transitionAgentSession(started, {
      content: PARKED,
      id: 'tool-1',
      isError: false,
      kind: 'tool-finished',
    });

    // The card is its own block kind: consecutive tool blocks collapse into
    // one activity disclosure, which would swallow a review shaped as a tool.
    expect(settled.transcript.filter((block) => block.kind === 'revision')).toEqual([
      {
        id: 'tool-1-revision',
        kind: 'revision',
        path: '/project/Research/plan.md',
        proposalId: 'proposal-1',
      },
    ]);
    // Settling the same call again cannot double the card.
    expect(
      transitionAgentSession(settled, {
        content: PARKED,
        id: 'tool-1',
        isError: false,
        kind: 'tool-finished',
      }).transcript.filter((block) => block.kind === 'revision'),
    ).toHaveLength(1);

    const failed = transitionAgentSession(started, {
      content: 'The document had moved on.',
      id: 'tool-1',
      isError: true,
      kind: 'tool-finished',
    });
    expect(failed.transcript.some((block) => block.kind === 'revision')).toBe(false);

    // A proposal matching the document is refused without an error, and a card
    // for it would offer a review that is never going to open.
    const unchanged = transitionAgentSession(started, {
      content: UNCHANGED,
      id: 'tool-1',
      isError: false,
      kind: 'tool-finished',
    });
    expect(unchanged.transcript.some((block) => block.kind === 'revision')).toBe(false);
  });

  it('treats only an identity-free empty transcript as reusable', () => {
    const session = createAgentSessionState({
      agent: 'stashbase',
      id: 'chat-1',
      scope: { kind: 'folder', path: '/project/Research' },
    });
    expect(session.connection).toEqual({ kind: 'draft' });
    expect(agentSessionIsBlank(session)).toBe(true);
    expect(agentSessionIsBlank({ ...session, nativeSessionId: 'native-1' })).toBe(false);
    expect(
      agentSessionIsBlank({
        ...session,
        transcript: [{ kind: 'user', id: 'message-1', text: 'Keep this.' }],
      }),
    ).toBe(false);
  });

  it('applies lifecycle actions without mutating the prior state', () => {
    const draft = createAgentSessionState({
      agent: 'codex',
      id: 'chat-1',
      scope: { kind: 'folder', path: '/project/Research' },
    });
    const connecting = transitionAgentSession(draft, { attempt: 0, kind: 'connect' });
    const restored = transitionAgentSession(connecting, {
      effort: 'high',
      lastModified: 42,
      nativeSessionId: 'native-1',
      transcript: [{ id: 'reply-1', kind: 'assistant', text: 'Retained answer' }],
      kind: 'restore',
    });

    expect(draft.connection).toEqual({ kind: 'draft' });
    expect(connecting).not.toBe(draft);
    expect(connecting.connection).toEqual({ attempt: 0, kind: 'connecting' });
    expect(restored).toMatchObject({
      effort: 'high',
      lastModified: 42,
      nativeSessionId: 'native-1',
      transcript: [{ id: 'reply-1', kind: 'assistant', text: 'Retained answer' }],
    });
  });

  it('requires and labels project scopes', () => {
    expect(() => scopeForWindowFolder(null)).toThrow('Open a project');
    expect(scopeForWindowFolder('/project/Research')).toEqual({
      kind: 'folder',
      path: '/project/Research',
    });

    expect(scopeLabel({ kind: 'folder', path: '/project/Research/' })).toBe('Research');
    expect(
      agentScopesEqual(
        { kind: 'folder', path: '/project/Research' },
        { kind: 'folder', path: '/project/Research' },
      ),
    ).toBe(true);
  });

  it('keeps permission races explicit and freezes denied tool output', () => {
    const initial = createAgentSessionState({
      agent: 'codex',
      id: 'chat-1',
      scope: { kind: 'folder', path: '/project/Research' },
    });
    const awaiting = transitionAgentSession(initial, {
      id: 'permission-1',
      input: { command: 'rm draft.md' },
      name: 'Bash',
      title: 'Delete draft.md?',
      toolUseId: 'tool-1',
      kind: 'permission-requested',
    });
    const startedLate = transitionAgentSession(awaiting, {
      id: 'tool-1',
      input: { command: 'rm draft.md' },
      name: 'Bash',
      kind: 'tool-started',
    });
    const denied = transitionAgentSession(startedLate, {
      allow: false,
      toolUseId: 'tool-1',
      kind: 'reply-permission',
    });
    const reopenedLate = transitionAgentSession(denied, {
      id: 'tool-1',
      input: { command: 'rm draft.md' },
      name: 'Bash',
      kind: 'tool-started',
    });
    const lateResult = transitionAgentSession(reopenedLate, {
      content: 'deleted',
      id: 'tool-1',
      isError: false,
      kind: 'tool-finished',
    });

    expect(startedLate.transcript[0]).toMatchObject({
      permissionId: 'permission-1',
      status: 'awaiting',
    });
    expect(reopenedLate.transcript[0]).toMatchObject({ status: 'denied' });
    expect(lateResult.transcript[0]).toMatchObject({ status: 'denied' });
    const settled = lateResult.transcript[0];
    expect(settled && 'result' in settled).toBe(false);
  });

  it('cancels pending tools and queued messages when their folder retires', () => {
    const initial = createAgentSessionState({
      agent: 'claude',
      id: 'chat-1',
      scope: { kind: 'folder', path: '/Library/Research' },
    });
    const running = transitionAgentSession(initial, {
      id: 'tool-1',
      input: {},
      name: 'Search',
      kind: 'tool-started',
    });
    const queued = transitionAgentSession(running, {
      queue: [{ context: [], id: 'queued-1', skill: null, text: 'Follow up' }],
      kind: 'set-queue',
    });
    const retired = transitionAgentSession(queued, { kind: 'retire' });

    expect(retired.connection).toEqual({ kind: 'retired' });
    expect(retired.queuedPrompts).toEqual([]);
    expect(retired.transcript).toEqual([
      expect.objectContaining({ id: 'tool-1', status: 'cancelled' }),
      expect.objectContaining({
        kind: 'notice',
        text: '1 queued message was cancelled when this folder was removed.',
      }),
    ]);
  });

  it('bounds queued follow-ups inside the session owner', () => {
    const initial = createAgentSessionState({
      agent: 'stashbase',
      id: 'chat-1',
      scope: { kind: 'folder', path: '/project/Research' },
    });
    const queued = transitionAgentSession(initial, {
      queue: Array.from({ length: 25 }, (_, index) => ({
        context: [],
        id: `queued-${index}`,
        skill: null,
        text: 'Next',
      })),
      kind: 'set-queue',
    });

    expect(queued.queuedPrompts).toHaveLength(20);
    expect(queued.queuedPrompts.at(-1)?.id).toBe('queued-19');
  });

  it('records a native file diff once as settled work', () => {
    const live = transitionAgentSession(
      createAgentSessionState({
        agent: 'stashbase',
        id: 'chat-1',
        scope: { kind: 'folder', path: '/project/Research' },
      }),
      { kind: 'ready' },
    );
    const change = {
      additions: 1,
      after: 'one\ntwo\n',
      before: 'one\n',
      deletions: 0,
      id: 'diff:1',
      path: 'notes.md',
      kind: 'file-changed' as const,
    };
    const recorded = transitionAgentSession(live, change);
    expect(recorded.transcript).toEqual([
      {
        id: 'diff:1',
        input: {
          additions: 1,
          after: 'one\ntwo\n',
          before: 'one\n',
          deletions: 0,
          path: 'notes.md',
        },
        kind: 'tool',
        name: 'FileDiff',
        status: 'done',
      },
    ]);
    expect(transitionAgentSession(recorded, change)).toBe(recorded);
  });

  it('sends bound context with the prompt and clears it from the draft', () => {
    const initial = createAgentSessionState({
      agent: 'codex',
      id: 'chat-1',
      scope: { kind: 'folder', path: '/project/Research' },
    });
    const context = [
      {
        boundVersion: 3,
        format: 'pdf' as const,
        kind: 'source' as const,
        source: { folderPath: '/project/Research', path: 'papers/report.pdf' },
      },
    ];
    const bound = transitionAgentSession(initial, { context, kind: 'set-context' });
    expect(agentSessionIsBlank(bound)).toBe(false);
    const refused = transitionAgentSession(bound, {
      message: 'This file is no longer in the folder.',
      kind: 'set-context-issue',
    });
    expect(refused.contextIssue).toBe('This file is no longer in the folder.');
    expect(transitionAgentSession(refused, { draft: 'x', kind: 'set-draft' }).contextIssue).toBe(
      null,
    );

    const sent = transitionAgentSession(refused, {
      at: 7,
      context,
      id: 'user-1',
      text: 'Summarize @papers/report.pdf',
      kind: 'submit-prompt',
    });
    expect(sent).toMatchObject({ context: [], contextIssue: null, draft: '' });
    expect(sent.transcript).toEqual([
      { at: 7, context, id: 'user-1', kind: 'user', text: 'Summarize @papers/report.pdf' },
    ]);
  });

  it('arms a skill only from the live catalog and spends it on one turn', () => {
    const initial = createAgentSessionState({
      agent: 'claude',
      id: 'chat-1',
      scope: { kind: 'folder', path: '/project/Research' },
    });
    expect(initial.skillCatalog).toEqual({ kind: 'empty' });

    const unknown = transitionAgentSession(initial, { skill: 'review', kind: 'set-skill' });
    expect(unknown.skill).toBe(null);

    const stocked = transitionAgentSession(initial, {
      error: null,
      skills: [
        { id: 'review', label: 'review', description: 'Review the draft' },
        { id: 'summarize', label: 'summarize' },
      ],
      state: 'available',
      kind: 'skills',
    });
    expect(stocked.skillCatalog).toEqual({
      kind: 'available',
      skills: [
        { id: 'review', label: 'review', description: 'Review the draft' },
        { id: 'summarize', label: 'summarize' },
      ],
    });

    const armed = transitionAgentSession(stocked, { skill: 'review', kind: 'set-skill' });
    expect(armed.skill).toBe('review');
    expect(agentSessionIsBlank(armed)).toBe(false);

    const sent = transitionAgentSession(armed, {
      at: 9,
      context: [],
      id: 'user-1',
      text: '/review Check the intro',
      kind: 'submit-prompt',
    });
    expect(sent.skill).toBe(null);
    expect(sent.transcript).toEqual([
      { at: 9, id: 'user-1', kind: 'user', text: '/review Check the intro' },
    ]);

    const shrunk = transitionAgentSession(armed, {
      error: null,
      skills: [{ id: 'summarize', label: 'summarize' }],
      state: 'available',
      kind: 'skills',
    });
    expect(shrunk.skill).toBe(null);

    const failed = transitionAgentSession(armed, {
      error: 'Skill directory is unreadable.',
      skills: [],
      state: 'failed',
      kind: 'skills',
    });
    expect(failed.skillCatalog).toEqual({
      kind: 'failed',
      message: 'Skill directory is unreadable.',
    });
    expect(failed.skill).toBe(null);
  });
});
