import { describe, expect, it } from 'vite-plus/test';

import { createAgentSessionState, MAX_QUEUED_PROMPTS } from './session-state';

const scope = { kind: 'folder', path: '/library/Research' } as const;

describe('createAgentSessionState', () => {
  it('opens a conversation as an unconnected draft with nothing bound to it', () => {
    const state = createAgentSessionState({ agent: 'codex', id: 'chat-1', scope });

    expect(state).toMatchObject({
      accessMode: 'auto',
      activeModel: null,
      agent: 'codex',
      connection: { kind: 'draft' },
      context: [],
      contextIssue: null,
      draft: '',
      effort: null,
      id: 'chat-1',
      lastModified: 0,
      model: null,
      models: [],
      nativeSessionId: null,
      queuedPrompts: [],
      scope,
      skill: null,
      skillCatalog: { kind: 'empty' },
      title: 'New chat',
      transcript: [],
    });
  });

  it('falls back to the default title for one that is blank', () => {
    expect(
      createAgentSessionState({ agent: 'codex', id: 'chat-1', scope, title: '  ' }).title,
    ).toBe('New chat');
    expect(
      createAgentSessionState({ agent: 'codex', id: 'chat-1', scope, title: ' Saved ' }).title,
    ).toBe('Saved');
  });

  it('refuses a conversation that could not be addressed later', () => {
    expect(() => createAgentSessionState({ agent: 'codex', id: ' ', scope })).toThrow(
      /must not be empty/u,
    );
    expect(() =>
      createAgentSessionState({
        agent: 'codex',
        id: 'chat-1',
        scope: { kind: 'folder', path: '  ' },
      }),
    ).toThrow(/must not be empty/u);
  });

  it('caps the queue at a screen of messages', () => {
    expect(MAX_QUEUED_PROMPTS).toBe(20);
  });
});
