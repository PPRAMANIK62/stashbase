import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';

import { createAgentWorkspaceRuntime } from '@/features/agent/application/workspace-runtime';
import { agentCatalogPort, BUILT_IN_AGENT, idleAgentSessionPort } from '@/test/fakes/agent';

import { useAgentAccess } from './use-agent-access';

afterEach(cleanup);

it('cancelling access aborts sign-in and rejects its late completion without sending', async () => {
  const runtime = createAgentWorkspaceRuntime({
    autostart: false,
    createId: () => 'fixture-chat',
    folderPath: '/project',
    port: idleAgentSessionPort(),
  });
  const session = runtime.activeSession();
  const send = vi.spyOn(session, 'sendPrompt');
  let finish!: (ready: boolean) => void;
  const onSignIn = vi.fn(
    (_signal?: AbortSignal) =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  const hook = renderHook(() =>
    useAgentAccess({
      runtime,
      agents: [{ ...BUILT_IN_AGENT, ready: false }],
      catalog: agentCatalogPort(),
      onSignIn,
      onRefresh: vi.fn(),
    }),
  );
  act(() => hook.result.current.send('Retained request'));
  let pending!: Promise<void>;
  act(() => {
    pending = hook.result.current.confirm();
  });
  await waitFor(() => expect(onSignIn).toHaveBeenCalledOnce());
  act(() => hook.result.current.cancel());
  expect(onSignIn.mock.calls[0]?.[0]?.aborted).toBe(true);
  await act(async () => {
    finish(true);
    await pending;
  });
  expect(send).not.toHaveBeenCalled();
  expect(hook.result.current.open).toBe(false);
  runtime.dispose();
});
