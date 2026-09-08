import { describe, expect, it, vi } from 'vite-plus/test';

import type { AgentSessionPort } from './ports';
import { createAgentWorkspaceRuntime } from './workspace-runtime';

function port(): AgentSessionPort {
  return {
    connect: vi.fn(() => ({ close: vi.fn() })),
    list: vi.fn(async () => []),
    remove: vi.fn(async () => undefined),
    rename: vi.fn(),
    replay: vi.fn(async () => ({ effort: null, transcript: [] })),
  };
}

describe('AgentWorkspaceRuntime', () => {
  it('starts with one Built-in chat and reuses only a completely blank tab', () => {
    let nextId = 0;
    const runtime = createAgentWorkspaceRuntime({
      createId: () => `chat-${++nextId}`,
      folderPath: '/library/Research',
      port: port(),
    });

    expect(runtime.store.getState().tabs).toMatchObject([
      {
        agent: 'stashbase',
        blank: true,
        id: 'chat-1',
        scope: { kind: 'folder', path: '/library/Research' },
      },
    ]);
    expect(runtime.newChat('codex').id).toBe('chat-1');
    runtime.activeSession().store.setState({ nativeSessionId: 'native-1' });
    expect(runtime.newChat('claude').id).toBe('chat-2');
  });

  it('focuses a chat in the selected folder without rebinding started work', () => {
    let nextId = 0;
    const runtime = createAgentWorkspaceRuntime({
      createId: () => `chat-${++nextId}`,
      folderPath: '/library/Research',
      port: port(),
    });
    runtime.setWindowFolder('/library/Plans');
    expect(runtime.activeSession().store.getState().scope).toEqual({
      kind: 'folder',
      path: '/library/Plans',
    });

    runtime.activeSession().store.setState({ nativeSessionId: 'native-1' });
    const retainedId = runtime.activeSession().id;
    runtime.setWindowFolder('/library/Archive');
    expect(runtime.activeSession().id).not.toBe(retainedId);
    expect(runtime.activeSession().store.getState().scope).toEqual({
      kind: 'folder',
      path: '/library/Archive',
    });
    expect(runtime.session(retainedId)?.store.getState().scope).toEqual({
      kind: 'folder',
      path: '/library/Plans',
    });

    runtime.setWindowFolder('/library/Plans');
    expect(runtime.activeSession().id).toBe(retainedId);
  });

  it('keeps blank drafts transport-free until active first use', () => {
    const sessionPort = port();
    const runtime = createAgentWorkspaceRuntime({
      autostart: false,
      createId: () => 'chat-1',
      folderPath: '/library/Research',
      port: sessionPort,
    });

    expect(sessionPort.connect).not.toHaveBeenCalled();
    expect(runtime.activeSession().store.getState().phase).toBe('draft');
    runtime.start(['stashbase', 'codex']);
    expect(sessionPort.connect).not.toHaveBeenCalled();

    runtime.newChat('codex');
    expect(sessionPort.connect).not.toHaveBeenCalled();

    runtime.startActive();
    expect(sessionPort.connect).toHaveBeenCalledOnce();
    expect(sessionPort.connect).toHaveBeenCalledWith(
      expect.objectContaining({ agent: 'codex' }),
      expect.anything(),
    );
  });

  it('advances local recency only when the user submits a prompt', () => {
    const runtime = createAgentWorkspaceRuntime({
      createId: () => 'chat-1',
      folderPath: '/library/Research',
      port: port(),
    });
    const session = runtime.activeSession();

    session.store.setState({ transcript: [{ at: 40, id: 'one', kind: 'user', text: 'First' }] });
    expect(runtime.store.getState().tabs[0]?.lastModified).toBe(40);

    session.store.setState({
      transcript: [
        { at: 40, id: 'one', kind: 'user', text: 'First' },
        { id: 'two', kind: 'assistant', text: 'Second' },
      ],
    });
    expect(runtime.store.getState().tabs[0]?.lastModified).toBe(40);

    session.store.setState({ phase: 'live' });
    expect(runtime.store.getState().tabs[0]?.lastModified).toBe(40);
  });

  it('keeps a restored chat at its recorded recency until a new prompt is sent', async () => {
    const sessionPort = port();
    vi.mocked(sessionPort.replay).mockResolvedValue({
      effort: null,
      transcript: [
        { at: 30, id: 'one', kind: 'user', text: 'Yesterday' },
        { id: 'two', kind: 'assistant', text: 'Reply' },
      ],
    });
    const runtime = createAgentWorkspaceRuntime({
      createId: () => 'chat-1',
      folderPath: '/library/Research',
      port: sessionPort,
    });

    await runtime.restore({
      agent: 'stashbase',
      hasContent: true,
      id: 'native-1',
      lastModified: 41,
      scope: { kind: 'folder', path: '/library/Research' },
      title: 'Yesterday',
    });
    expect(runtime.store.getState().tabs[0]?.lastModified).toBe(41);
  });

  it('moves only blank removed-folder chats to Library and retires retained work', () => {
    let nextId = 0;
    const runtime = createAgentWorkspaceRuntime({
      createId: () => `chat-${++nextId}`,
      folderPath: '/library/Research',
      port: port(),
    });
    const retained = runtime.activeSession();
    retained.store.setState({
      nativeSessionId: 'native-1',
      transcript: [{ kind: 'user', id: 'message-1', text: 'Keep this.' }],
    });
    const blank = runtime.newChat('codex', { kind: 'folder', path: '/library/Research' });

    runtime.retireFolder('/library/Research');

    expect(retained.store.getState().phase).toBe('retired');
    expect(blank.store.getState().phase).toBe('disposed');
    expect(runtime.session(blank.id)?.store.getState().scope).toEqual({ kind: 'library' });

    runtime.setWindowFolder('/library/Plans');
    expect(runtime.session(blank.id)?.store.getState().scope).toEqual({
      kind: 'folder',
      path: '/library/Plans',
    });
    expect(retained.store.getState().scope).toEqual({
      kind: 'folder',
      path: '/library/Research',
    });
  });

  it('routes history mutations through the native agent and scope and reconciles open tabs', async () => {
    const sessionPort = port();
    vi.mocked(sessionPort.rename).mockResolvedValue({
      agent: 'stashbase',
      hasContent: true,
      id: 'native-1',
      lastModified: 42,
      scope: { kind: 'folder', path: '/library/Research' },
      title: 'Renamed',
    });
    const runtime = createAgentWorkspaceRuntime({
      createId: () => 'chat-1',
      folderPath: '/library/Research',
      port: sessionPort,
    });
    const session = runtime.activeSession();
    session.store.setState({ nativeSessionId: 'native-1', title: 'Before' });
    const scope = { kind: 'folder' as const, path: '/library/Research' };
    const entry = {
      agent: 'stashbase' as const,
      hasContent: true,
      id: 'native-1',
      lastModified: 41,
      scope,
      title: 'Before',
    };
    const signal = new AbortController().signal;

    await runtime.renameHistory(entry, 'Renamed', signal);
    expect(session.store.getState().title).toBe('Renamed');
    expect(sessionPort.rename).toHaveBeenCalledWith(entry, 'Renamed', expect.any(AbortSignal));

    await runtime.removeHistory(entry, signal);
    expect(sessionPort.remove).toHaveBeenCalledWith(entry, expect.any(AbortSignal));
    expect(session.store.getState().phase).toBe('disposed');
    expect(runtime.activeSession().isBlank()).toBe(true);
  });

  it('keeps the active conversation in the selected folder after deleting its last open chat', async () => {
    let nextId = 0;
    const sessionPort = port();
    const runtime = createAgentWorkspaceRuntime({
      createId: () => `chat-${++nextId}`,
      folderPath: '/library/Research',
      port: sessionPort,
    });
    runtime.activeSession().store.setState({ nativeSessionId: 'research-chat' });
    runtime.setWindowFolder('/library/Plans');
    runtime.activeSession().store.setState({ nativeSessionId: 'plans-chat' });
    const entry = {
      agent: 'stashbase' as const,
      hasContent: true,
      id: 'plans-chat',
      lastModified: 42,
      scope: { kind: 'folder' as const, path: '/library/Plans' },
      title: 'Plans',
    };

    await runtime.removeHistory(entry, new AbortController().signal);

    expect(runtime.activeSession().store.getState().scope).toEqual(entry.scope);
    expect(runtime.activeSession().isBlank()).toBe(true);
  });
});
