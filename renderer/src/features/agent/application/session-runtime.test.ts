import { describe, expect, it, vi } from 'vite-plus/test';

import type { AgentConnectionListener, AgentReconnectScheduler, AgentSessionPort } from './ports';
import { createAgentSessionRuntime } from './session-runtime';

function harness() {
  const listeners: AgentConnectionListener[] = [];
  const requests: Array<{ resume?: string }> = [];
  const sent: unknown[] = [];
  const waits: Array<() => void> = [];
  const port: AgentSessionPort = {
    connect(request, listener) {
      requests.push(request);
      listeners.push(listener);
      return {
        close: vi.fn(),
        send: vi.fn((event) => {
          sent.push(event);
          return true;
        }),
      };
    },
    list: vi.fn(async () => []),
    remove: vi.fn(async () => undefined),
    rename: vi.fn(),
    replay: vi.fn(async () => ({
      effort: 'high',
      transcript: [
        { kind: 'user' as const, id: 'user-1', text: 'Keep this question.' },
        { kind: 'assistant' as const, id: 'assistant-1', text: 'Keep this answer.' },
      ],
    })),
  };
  const scheduler: AgentReconnectScheduler = {
    jitter: (value) => value,
    wait: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          waits.push(resolve);
        }),
    ),
  };
  return { listeners, port, requests, scheduler, sent, waits };
}

describe('AgentSessionRuntime', () => {
  it('keeps an explicit draft local until its first-use boundary starts transport', () => {
    const test = harness();
    const runtime = createAgentSessionRuntime({
      agent: 'codex',
      autostart: false,
      id: 'chat-1',
      port: test.port,
      scheduler: test.scheduler,
      scope: { kind: 'folder', path: '/library/Research' },
    });

    expect(runtime.store.getState().phase).toBe('draft');
    expect(test.requests).toHaveLength(0);

    runtime.start();

    expect(runtime.store.getState().phase).toBe('connecting');
    expect(test.requests).toHaveLength(1);
  });

  it('connects a scoped session and handles normalized lifecycle events', () => {
    const test = harness();
    const runtime = createAgentSessionRuntime({
      agent: 'codex',
      id: 'chat-1',
      port: test.port,
      scheduler: test.scheduler,
      scope: { kind: 'folder', path: '/library/Research' },
    });

    expect(test.requests[0]).toEqual({
      access: 'auto',
      agent: 'codex',
      effort: undefined,
      model: undefined,
      resume: undefined,
      scope: { kind: 'folder', path: '/library/Research' },
    });
    test.listeners[0]?.onEvent({ kind: 'ready' });
    test.listeners[0]?.onEvent({ id: 'native-1', kind: 'identified' });
    expect(runtime.store.getState()).toMatchObject({
      nativeSessionId: 'native-1',
      phase: 'live',
    });

    runtime.dispose();
    test.listeners[0]?.onEvent({ kind: 'titled', title: 'Too late' });
    expect(runtime.store.getState().title).toBe('New chat');
    expect(runtime.store.getState().phase).toBe('disposed');
  });

  it('retains runtime model catalogs and reconnects idle thinking changes', () => {
    const test = harness();
    const runtime = createAgentSessionRuntime({
      agent: 'codex',
      id: 'chat-1',
      port: test.port,
      scheduler: test.scheduler,
      scope: { kind: 'library' },
    });
    test.listeners[0]?.onEvent({
      activeModel: null,
      fallback: null,
      kind: 'models',
      models: [{ id: 'gpt-codex', label: 'GPT Codex', supportedEfforts: ['low', 'high'] }],
    });
    test.listeners[0]?.onEvent({ kind: 'ready' });

    runtime.setModel('gpt-codex');
    expect(test.sent.at(-1)).toEqual({ model: 'gpt-codex', t: 'set-model' });
    expect(runtime.store.getState().model).toBe('gpt-codex');

    runtime.setEffort('high');
    expect(test.requests).toHaveLength(2);
    expect(test.requests.at(-1)).toMatchObject({ effort: 'high', model: 'gpt-codex' });
    expect(runtime.store.getState().effort).toBe('high');
  });

  it('sends the retained first-use draft once readiness arrives and streams tool work', () => {
    const test = harness();
    const runtime = createAgentSessionRuntime({
      agent: 'codex',
      autostart: false,
      id: 'chat-1',
      port: test.port,
      scheduler: test.scheduler,
      scope: { kind: 'library' },
    });

    runtime.setDraft('  Inspect the project  ');
    expect(runtime.sendPrompt()).toBe(true);
    expect(runtime.store.getState()).toMatchObject({
      draft: 'Inspect the project',
      phase: 'connecting',
    });
    expect(test.sent).toEqual([]);

    test.listeners[0]?.onEvent({ kind: 'ready' });
    test.listeners[0]?.onEvent({ kind: 'turn-started' });
    test.listeners[0]?.onEvent({
      id: 'tool-1',
      input: { command: 'pwd' },
      kind: 'tool-started',
      name: 'Bash',
    });
    test.listeners[0]?.onEvent({ delta: '/project', id: 'tool-1', kind: 'tool-output' });

    expect(test.sent).toEqual([{ t: 'prompt', text: 'Inspect the project' }]);
    expect(runtime.store.getState()).toMatchObject({ activeTurn: true, draft: '' });
    expect(runtime.store.getState().transcript).toEqual([
      expect.objectContaining({ kind: 'user', text: 'Inspect the project' }),
      {
        id: 'tool-1',
        input: { command: 'pwd' },
        kind: 'tool',
        name: 'Bash',
        result: '/project',
        status: 'running',
      },
    ]);
  });

  it('answers only the current permission request and keeps the decision inspectable', () => {
    const test = harness();
    const runtime = createAgentSessionRuntime({
      agent: 'codex',
      id: 'chat-1',
      port: test.port,
      scheduler: test.scheduler,
      scope: { kind: 'library' },
    });
    test.listeners[0]?.onEvent({ kind: 'ready' });
    test.listeners[0]?.onEvent({
      id: 'permission-1',
      input: { command: 'pnpm test' },
      kind: 'permission-requested',
      name: 'Bash',
      title: null,
      toolUseId: 'tool-1',
    });

    expect(runtime.replyPermission('tool-1', 'stale', true)).toBe(false);
    expect(runtime.replyPermission('tool-1', 'permission-1', false)).toBe(true);
    expect(runtime.replyPermission('tool-1', 'permission-1', true)).toBe(false);
    expect(test.sent).toEqual([
      { allow: false, always: undefined, id: 'permission-1', t: 'permission-reply' },
    ]);
    expect(runtime.store.getState().transcript).toEqual([
      expect.objectContaining({
        id: 'tool-1',
        permissionRequested: true,
        status: 'denied',
      }),
    ]);
  });

  it('replays a mode changed during connection and retries without duplicating the prompt', () => {
    const test = harness();
    const runtime = createAgentSessionRuntime({
      agent: 'codex',
      id: 'chat-1',
      port: test.port,
      scheduler: test.scheduler,
      scope: { kind: 'library' },
    });
    runtime.setAccessMode('default');
    test.listeners[0]?.onEvent({ kind: 'ready' });
    expect(test.sent).toEqual([{ mode: 'default', t: 'set-mode' }]);

    runtime.setDraft('Keep one prompt');
    expect(runtime.sendPrompt()).toBe(true);
    test.listeners[0]?.onEvent({ kind: 'failed', message: 'Network unavailable.' });
    const failure = runtime.store.getState().transcript.find((block) => block.kind === 'error');
    expect(failure?.kind).toBe('error');
    expect(runtime.retry(failure!.id)).toBe(true);

    expect(
      runtime.store.getState().transcript.filter((block) => block.kind === 'user'),
    ).toHaveLength(1);
    expect(runtime.store.getState()).toMatchObject({ activeTurn: true });
    expect(test.sent.at(-1)).toEqual({ t: 'prompt', text: 'Keep one prompt' });
  });

  it('loads replay before reconnecting exactly that native session', async () => {
    const test = harness();
    const runtime = createAgentSessionRuntime({
      agent: 'claude',
      id: 'chat-1',
      port: test.port,
      scheduler: test.scheduler,
      scope: { kind: 'library' },
    });

    const entry = {
      agent: 'claude' as const,
      hasContent: true,
      id: 'native-2',
      lastModified: 42,
      scope: { kind: 'library' as const },
      title: 'Saved conversation',
    };
    await expect(runtime.restore(entry)).resolves.toBe(true);
    expect(test.port.replay).toHaveBeenCalledWith(entry, runtime.signal);
    expect(test.requests.at(-1)).toMatchObject({ effort: 'high', resume: 'native-2' });
    expect(runtime.store.getState()).toMatchObject({
      nativeSessionId: 'native-2',
      title: 'Saved conversation',
      transcript: [
        { kind: 'user', id: 'user-1', text: 'Keep this question.' },
        { kind: 'assistant', id: 'assistant-1', text: 'Keep this answer.' },
      ],
    });

    runtime.start();
    expect(test.requests).toHaveLength(2);
  });

  it('reconnects raw transport loss with a bounded schedule and retained identity', async () => {
    const test = harness();
    const runtime = createAgentSessionRuntime({
      agent: 'stashbase',
      id: 'chat-1',
      port: test.port,
      scheduler: test.scheduler,
      scope: { kind: 'library' },
    });
    test.listeners[0]?.onEvent({ id: 'native-3', kind: 'identified' });
    test.listeners[0]?.onEvent({ kind: 'ready' });

    for (let index = 0; index < 3; index += 1) {
      test.listeners[index]?.onClose();
      test.waits[index]?.();
      await Promise.resolve();
      expect(test.requests[index + 1]?.resume).toBe('native-3');
    }
    test.listeners[3]?.onClose();

    expect(runtime.store.getState()).toMatchObject({
      phase: 'closed',
      reconnectAttempt: 3,
    });
    expect(runtime.store.getState().error).toContain('Reconnect to continue');
  });

  it('retires a removed folder without reconnecting it', () => {
    const test = harness();
    const runtime = createAgentSessionRuntime({
      agent: 'codex',
      id: 'chat-1',
      port: test.port,
      scheduler: test.scheduler,
      scope: { kind: 'folder', path: '/library/Research' },
    });
    runtime.retire('/library/Research');
    runtime.reconnect();

    expect(runtime.store.getState().phase).toBe('retired');
    expect(test.requests).toHaveLength(1);
  });
});
