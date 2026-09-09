/** One turn from the runtime's side: the retained draft that starts it, the
 *  tool work and file reports it streams, the permission decision it asks for,
 *  and the retry that must not duplicate the prompt behind it. */
import { describe, expect, it, vi } from 'vite-plus/test';

import { agentTurnIsActive } from '@/features/agent/domain/session';
import { agentSessionPort } from '@/test/fakes/agent';

import { type AgentReconnectScheduler, type AgentSessionPort } from './ports';
import { createAgentSessionRuntime } from './session-runtime';

type AgentConnectRequest = Parameters<AgentSessionPort['connect']>[0];

function harness() {
  const waits: Array<() => void> = [];
  const { listeners, port, sent } = agentSessionPort({
    replay: vi.fn(async () => ({
      effort: 'high',
      transcript: [
        { kind: 'user' as const, id: 'user-1', text: 'Keep this question.' },
        { kind: 'assistant' as const, id: 'assistant-1', text: 'Keep this answer.' },
      ],
    })),
  });
  const scheduler: AgentReconnectScheduler = {
    jitter: (value) => value,
    wait: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          waits.push(resolve);
        }),
    ),
  };
  /** Every connect request in order, read back off the port's own spy. */
  const requests = (): AgentConnectRequest[] =>
    vi.mocked(port.connect).mock.calls.map(([request]) => request);
  return { listeners, port, requests, scheduler, sent, waits };
}

describe('AgentSessionRuntime turns', () => {
  it('sends the retained first-use draft once readiness arrives and streams tool work', async () => {
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
    await expect(runtime.sendPrompt()).resolves.toEqual({ ok: true });
    expect(runtime.store.getState()).toMatchObject({
      connection: { attempt: 0, kind: 'connecting' },
      draft: 'Inspect the project',
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

    expect(test.sent).toEqual([{ kind: 'prompt', skill: null, text: 'Inspect the project' }]);
    expect(runtime.store.getState()).toMatchObject({
      connection: { kind: 'live', turn: { promptBlockId: expect.any(String) } },
      draft: '',
    });
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

  it('reports files only after a write settles successfully or a native diff arrives', () => {
    const test = harness();
    const onFilesChanged = vi.fn();
    const runtime = createAgentSessionRuntime({
      agent: 'claude',
      id: 'chat-1',
      onFilesChanged,
      port: test.port,
      scheduler: test.scheduler,
      scope: { kind: 'folder', path: '/library/Research' },
    });
    const listener = test.listeners[0];
    listener?.onEvent({ kind: 'ready' });
    listener?.onEvent({
      id: 'write-1',
      input: { content: '# Notes', file_path: '/library/Research/notes.md' },
      kind: 'tool-started',
      name: 'Write',
    });
    listener?.onEvent({
      id: 'read-1',
      input: { file_path: '/library/Research/notes.md' },
      kind: 'tool-started',
      name: 'Read',
    });
    listener?.onEvent({ content: '', id: 'read-1', isError: false, kind: 'tool-finished' });
    listener?.onEvent({ content: 'EACCES', id: 'write-1', isError: true, kind: 'tool-finished' });
    expect(onFilesChanged).not.toHaveBeenCalled();

    listener?.onEvent({
      id: 'edit-1',
      input: { file_path: 'plan.md', new_string: 'b', old_string: 'a' },
      kind: 'tool-started',
      name: 'Edit',
    });
    listener?.onEvent({ content: 'ok', id: 'edit-1', isError: false, kind: 'tool-finished' });
    listener?.onEvent({
      additions: 1,
      after: 'x\n',
      before: '',
      deletions: 0,
      id: 'diff:1',
      kind: 'file-changed',
      path: 'new.md',
    });

    expect(onFilesChanged.mock.calls).toEqual([
      [
        {
          paths: ['plan.md'],
          scope: { kind: 'folder', path: '/library/Research' },
          sources: [{ folderPath: '/library/Research', path: 'plan.md' }],
        },
      ],
      [
        {
          paths: ['new.md'],
          scope: { kind: 'folder', path: '/library/Research' },
          sources: [{ folderPath: '/library/Research', path: 'new.md' }],
        },
      ],
    ]);
    expect(runtime.store.getState().transcript.at(-1)).toMatchObject({
      name: 'FileDiff',
      status: 'done',
    });
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
      { allow: false, always: null, id: 'permission-1', kind: 'reply-permission' },
    ]);
    expect(runtime.store.getState().transcript).toEqual([
      expect.objectContaining({
        id: 'tool-1',
        permissionRequested: true,
        status: 'denied',
      }),
    ]);
  });

  it('replays a mode changed during connection and retries without duplicating the prompt', async () => {
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
    expect(test.sent).toEqual([{ kind: 'set-access-mode', mode: 'default' }]);

    runtime.setDraft('Keep one prompt');
    await expect(runtime.sendPrompt()).resolves.toEqual({ ok: true });
    test.listeners[0]?.onEvent({ kind: 'failed', message: 'Network unavailable.' });
    const failure = runtime.store.getState().transcript.find((block) => block.kind === 'error');
    expect(failure?.kind).toBe('error');
    expect(runtime.retry(failure?.id ?? '')).toBe(true);

    expect(
      runtime.store.getState().transcript.filter((block) => block.kind === 'user'),
    ).toHaveLength(1);
    expect(agentTurnIsActive(runtime.store.getState().connection)).toBe(true);
    expect(test.sent.at(-1)).toEqual({ kind: 'prompt', skill: null, text: 'Keep one prompt' });
  });
});
