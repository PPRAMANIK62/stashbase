import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { settingsQueryKeys } from '@/features/settings/application/queries';
import { accountPort, SIGNED_IN_ACCOUNT, SIGNED_OUT_ACCOUNT } from '@/test/fakes/settings';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { useAccount } from './use-account';

afterEach(cleanup);

function mount(port = accountPort(), openExternal = vi.fn()) {
  const queryClient = createTestQueryClient();
  const hook = renderHook(() => useAccount(port, openExternal), {
    wrapper: queryWrapper(queryClient),
  });
  return { hook, openExternal, port, queryClient };
}

describe('useAccount', () => {
  it('opens the browser for a sign-in and holds one pending flag across the whole round trip', async () => {
    const port = accountPort(SIGNED_OUT_ACCOUNT, {
      signInStatus: vi.fn(async () => ({ state: 'complete' as const })),
    });
    const { hook, openExternal } = mount(port);
    await waitFor(() => expect(hook.result.current.account).toEqual(SIGNED_OUT_ACCOUNT));

    act(() => hook.result.current.signIn());

    await waitFor(() =>
      expect(openExternal).toHaveBeenCalledWith('https://accounts.example/sign-in'),
    );
    await waitFor(() => expect(hook.result.current.signInPending).toBe(false));
    expect(port.signInStatus).toHaveBeenCalledWith('flow-1', expect.any(AbortSignal));
    // The account is read again once the flow completes.
    await waitFor(() => expect(port.load).toHaveBeenCalledTimes(2));
  });

  it('re-reads what depends on the account once a sign-in lands', async () => {
    const port = accountPort(SIGNED_OUT_ACCOUNT, {
      signInStatus: vi.fn(async () => ({ state: 'complete' as const })),
    });
    const { hook, queryClient } = mount(port);
    await waitFor(() => expect(hook.result.current.account).not.toBeNull());
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => hook.result.current.signIn());

    await waitFor(() => expect(hook.result.current.signInPending).toBe(false));
    const invalidated = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(invalidated).toEqual(
      expect.arrayContaining([
        settingsQueryKeys.account,
        settingsQueryKeys.agentCatalog,
        settingsQueryKeys.agentAllowance,
        settingsQueryKeys.embedder,
      ]),
    );
  });

  it('keeps a failed sign-in visible as something the reader must act on', async () => {
    const port = accountPort(SIGNED_OUT_ACCOUNT, {
      signInStatus: vi.fn(async () => ({ error: 'Denied', state: 'error' as const })),
    });
    const { hook } = mount(port);

    act(() => hook.result.current.signIn());

    await waitFor(() =>
      expect(hook.result.current.failure).toEqual({ message: 'Denied', tone: 'input' }),
    );
    expect(hook.result.current.signInPending).toBe(false);
  });

  it('writes the signed-out account a sign-out answers with', async () => {
    const port = accountPort(SIGNED_IN_ACCOUNT);
    const { hook } = mount(port);
    await waitFor(() => expect(hook.result.current.account?.signedIn).toBe(true));

    act(() => hook.result.current.signOut());

    await waitFor(() => expect(hook.result.current.account).toEqual(SIGNED_OUT_ACCOUNT));
    expect(port.signOut).toHaveBeenCalledOnce();
    expect(port.load).toHaveBeenCalledTimes(1);
  });
});
