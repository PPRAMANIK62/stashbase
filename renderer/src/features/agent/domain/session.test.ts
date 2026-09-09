import { describe, expect, it } from 'vite-plus/test';

import {
  agentScopesEqual,
  agentSessionIsBlank,
  createAgentSessionState,
  scopeForWindowFolder,
  scopeLabel,
  transitionAgentSession,
} from './session';

describe('Agent session domain', () => {
  it('treats only an identity-free empty transcript as reusable', () => {
    const session = createAgentSessionState({
      agent: 'stashbase',
      id: 'chat-1',
      scope: { kind: 'library' },
    });
    expect(session.phase).toBe('draft');
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
      scope: { kind: 'library' },
    });
    const connecting = transitionAgentSession(draft, { type: 'connect' });
    const restored = transitionAgentSession(connecting, {
      effort: 'high',
      lastModified: 42,
      nativeSessionId: 'native-1',
      transcript: [{ id: 'reply-1', kind: 'assistant', text: 'Retained answer' }],
      type: 'restore',
    });

    expect(draft.phase).toBe('draft');
    expect(connecting).not.toBe(draft);
    expect(connecting.phase).toBe('connecting');
    expect(restored).toMatchObject({
      effort: 'high',
      lastModified: 42,
      nativeSessionId: 'native-1',
      transcript: [{ id: 'reply-1', kind: 'assistant', text: 'Retained answer' }],
    });
  });

  it('resolves and labels explicit Library and folder scopes', () => {
    expect(scopeForWindowFolder(null)).toEqual({ kind: 'library' });
    expect(scopeForWindowFolder('/library/Research')).toEqual({
      kind: 'folder',
      path: '/library/Research',
    });
    expect(scopeLabel({ kind: 'library' })).toBe('Library');
    expect(scopeLabel({ kind: 'folder', path: '/library/Research/' })).toBe('Research');
    expect(
      agentScopesEqual(
        { kind: 'folder', path: '/library/Research' },
        { kind: 'folder', path: '/library/Research' },
      ),
    ).toBe(true);
  });

  it('keeps permission races explicit and freezes denied tool output', () => {
    const initial = createAgentSessionState({
      agent: 'codex',
      id: 'chat-1',
      scope: { kind: 'library' },
    });
    const awaiting = transitionAgentSession(initial, {
      id: 'permission-1',
      input: { command: 'rm draft.md' },
      name: 'Bash',
      title: 'Delete draft.md?',
      toolUseId: 'tool-1',
      type: 'request-permission',
    });
    const startedLate = transitionAgentSession(awaiting, {
      id: 'tool-1',
      input: { command: 'rm draft.md' },
      name: 'Bash',
      type: 'start-tool',
    });
    const denied = transitionAgentSession(startedLate, {
      allow: false,
      toolUseId: 'tool-1',
      type: 'reply-permission',
    });
    const reopenedLate = transitionAgentSession(denied, {
      id: 'tool-1',
      input: { command: 'rm draft.md' },
      name: 'Bash',
      type: 'start-tool',
    });
    const lateResult = transitionAgentSession(reopenedLate, {
      content: 'deleted',
      id: 'tool-1',
      isError: false,
      type: 'finish-tool',
    });

    expect(startedLate.transcript[0]).toMatchObject({
      permissionId: 'permission-1',
      status: 'awaiting',
    });
    expect(reopenedLate.transcript[0]).toMatchObject({ status: 'denied' });
    expect(lateResult.transcript[0]).toMatchObject({ status: 'denied' });
    expect('result' in lateResult.transcript[0]!).toBe(false);
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
      type: 'start-tool',
    });
    const queued = transitionAgentSession(running, {
      queue: [{ context: [], id: 'queued-1', text: 'Follow up' }],
      type: 'set-queue',
    });
    const retired = transitionAgentSession(queued, { type: 'retire' });

    expect(retired.phase).toBe('retired');
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
      scope: { kind: 'library' },
    });
    const queued = transitionAgentSession(initial, {
      queue: Array.from({ length: 25 }, (_, index) => ({
        context: [],
        id: `queued-${index}`,
        text: 'Next',
      })),
      type: 'set-queue',
    });

    expect(queued.queuedPrompts).toHaveLength(20);
    expect(queued.queuedPrompts.at(-1)?.id).toBe('queued-19');
  });

  it('records a native file diff once as settled work', () => {
    const live = transitionAgentSession(
      createAgentSessionState({ agent: 'stashbase', id: 'chat-1', scope: { kind: 'library' } }),
      { type: 'ready' },
    );
    const change = {
      additions: 1,
      after: 'one\ntwo\n',
      before: 'one\n',
      deletions: 0,
      id: 'diff:1',
      path: 'notes.md',
      type: 'record-file-change' as const,
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
      scope: { kind: 'folder', path: '/library/Research' },
    });
    const context = [
      {
        boundVersion: 3,
        format: 'pdf' as const,
        kind: 'source' as const,
        source: { folderPath: '/library/Research', path: 'papers/report.pdf' },
      },
    ];
    const bound = transitionAgentSession(initial, { context, type: 'set-context' });
    expect(agentSessionIsBlank(bound)).toBe(false);
    const refused = transitionAgentSession(bound, {
      message: 'This file is no longer in the folder.',
      type: 'set-context-issue',
    });
    expect(refused.contextIssue).toBe('This file is no longer in the folder.');
    expect(transitionAgentSession(refused, { draft: 'x', type: 'set-draft' }).contextIssue).toBe(
      null,
    );

    const sent = transitionAgentSession(refused, {
      at: 7,
      context,
      id: 'user-1',
      text: 'Summarize @papers/report.pdf',
      type: 'submit-prompt',
    });
    expect(sent).toMatchObject({ context: [], contextIssue: null, draft: '' });
    expect(sent.transcript).toEqual([
      { at: 7, context, id: 'user-1', kind: 'user', text: 'Summarize @papers/report.pdf' },
    ]);
  });
});
