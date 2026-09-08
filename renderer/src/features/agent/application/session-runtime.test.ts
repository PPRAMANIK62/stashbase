import { describe, expect, it, vi } from 'vite-plus/test';

import type { AgentConnectionListener, AgentReconnectScheduler, AgentSessionPort } from './ports';
import { createAgentSessionRuntime } from './session-runtime';

function harness() {
  const listeners: AgentConnectionListener[] = [];
  const requests: Array<{ resume?: string }> = [];
  const waits: Array<() => void> = [];
  const port: AgentSessionPort = {
    connect(request, listener) {
      requests.push(request);
      listeners.push(listener);
      return { close: vi.fn() };
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
  return { listeners, port, requests, scheduler, waits };
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
      agent: 'codex',
      effort: undefined,
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
