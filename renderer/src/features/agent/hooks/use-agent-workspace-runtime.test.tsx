import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { agentContextPort, idleAgentSessionPort } from '@/test/fakes/agent';

import { useAgentWorkspaceRuntime } from './use-agent-workspace-runtime';

afterEach(cleanup);

type FolderRemovedSubscription = (handler: (folderPath: string) => void) => () => void;

const noSubscription: FolderRemovedSubscription = () => () => undefined;

function mount(
  folderPath: string | null,
  subscribeFolderRemoved: FolderRemovedSubscription = noSubscription,
) {
  let nextId = 0;
  return renderHook(
    ({ folder }: { folder: string | null }) =>
      useAgentWorkspaceRuntime({
        context: agentContextPort(),
        createId: () => `chat-${++nextId}`,
        folderPath: folder,
        session: idleAgentSessionPort(),
        subscribeFolderRemoved,
      }),
    { initialProps: { folder: folderPath } },
  );
}

describe('useAgentWorkspaceRuntime', () => {
  it('keeps one runtime for the window and republishes the folder it moves to', () => {
    const hook = mount('/library/Research');
    const runtime = hook.result.current;

    hook.rerender({ folder: '/library/Plans' });

    // A folder change rebinds the window's runtime rather than replacing it,
    // which is what lets a started conversation survive the move.
    expect(hook.result.current).toBe(runtime);
    expect(runtime.activeSession().store.getState().scope).toEqual({
      kind: 'folder',
      path: '/library/Plans',
    });
  });

  it('retires the sessions bound to a folder the host removed', () => {
    const removed: Array<(folderPath: string) => void> = [];
    const hook = mount('/library/Research', (handler) => {
      removed.push(handler);
      return () => undefined;
    });
    const session = hook.result.current.activeSession();
    session.store.setState({ nativeSessionId: 'native-1' });

    for (const handler of removed) handler('/library/Research');

    expect(session.store.getState().connection.kind).toBe('retired');
  });

  it('disposes the runtime and drops its host subscription when the window goes', () => {
    const unsubscribe = vi.fn();
    const hook = mount('/library/Research', () => unsubscribe);
    const runtime = hook.result.current;
    const session = runtime.activeSession();

    hook.unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
    // The retained runtime defers teardown by a microtask so a StrictMode
    // remount can cancel it; a real unmount still tears down before the next.
    return Promise.resolve().then(() => {
      expect(session.store.getState().connection.kind).toBe('disposed');
    });
  });
});
