import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { EmbedderPort, EmbedderState } from '@/features/settings/application/embedder-port';

import { useEmbedder } from './use-embedder';

function queryWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

const initial: EmbedderState = {
  account: { active: false, signedIn: false },
  authorized: false,
  hasKey: false,
  model: 'm',
  provider: 'openai',
  source: 'openai',
};

function fakePort(overrides: Partial<EmbedderPort> = {}): EmbedderPort {
  return {
    load: vi.fn(async () => initial),
    refreshAccount: vi.fn(async () => initial.account),
    removeKey: vi.fn(async () => initial),
    saveKey: vi.fn(async () => ({
      authorized: true as const,
      hasKey: true as const,
      model: 'm',
      provider: 'openai' as const,
      source: 'openai' as const,
    })),
    selectProvider: vi.fn(async () => ({ ...initial, authorized: true, hasKey: true })),
    signInStatus: vi.fn(async () => ({ state: 'complete' as const })),
    signOut: vi.fn(async () => undefined),
    startSignIn: vi.fn(async () => ({
      flowId: 'flow-1',
      provider: 'google' as const,
      purpose: 'embedding' as const,
      url: 'https://accounts.example/sign-in',
    })),
    useAccount: vi.fn(async () => initial.account),
    ...overrides,
  };
}

afterEach(cleanup);

describe('useEmbedder', () => {
  it('reloads the state after a key is saved', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const port = fakePort();
    const hook = renderHook(() => useEmbedder(port, true), { wrapper: queryWrapper(queryClient) });
    await waitFor(() => expect(hook.result.current.state.data).toEqual(initial));

    act(() => hook.result.current.saveKey.mutate({ key: 'sk', provider: 'openai' }));

    await waitFor(() => expect(hook.result.current.saveKey.isSuccess).toBe(true));
    expect(port.saveKey).toHaveBeenCalledWith('openai', 'sk', expect.any(AbortSignal));
    await waitFor(() => expect(port.load).toHaveBeenCalledTimes(2));
  });

  it('tracks a sign-in flow until the server reports completion', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const port = fakePort();
    const hook = renderHook(() => useEmbedder(port, true), { wrapper: queryWrapper(queryClient) });
    await waitFor(() => expect(hook.result.current.state.data).toEqual(initial));

    act(() => hook.result.current.startSignIn.mutate());

    await waitFor(() => expect(hook.result.current.startSignIn.data?.url).toContain('sign-in'));
    await waitFor(() => expect(hook.result.current.signInPending).toBe(false));
    expect(port.signInStatus).toHaveBeenCalledWith('flow-1', expect.any(AbortSignal));
    await waitFor(() => expect(port.load).toHaveBeenCalledTimes(2));
  });

  it('keeps a failed sign-in visible', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const port = fakePort({
      signInStatus: vi.fn(async () => ({ error: 'Denied', state: 'error' as const })),
    });
    const hook = renderHook(() => useEmbedder(port, true), { wrapper: queryWrapper(queryClient) });

    act(() => hook.result.current.startSignIn.mutate());

    await waitFor(() => expect(hook.result.current.signInError).toBe('Denied'));
  });
});
