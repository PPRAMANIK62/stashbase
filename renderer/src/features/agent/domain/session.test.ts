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
});
