import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { AgentRuntimePort } from '@/features/settings/application/ports';
import { agentCatalogQueryKeys } from '@/features/settings/application/queries';
import type { HostedAgentAllowance } from '@/shared/account';
import type { Agent, AgentsResponse } from '@/shared/agent-runtime';

import { useAgentRuntimes } from './use-agent-runtimes';

function queryWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function agent(overrides: Partial<Agent>): Agent {
  return {
    id: 'codex',
    label: 'Codex',
    vendor: 'OpenAI',
    installHint: '',
    installed: true,
    launchCommand: 'codex',
    ...overrides,
  };
}

function catalog(clis: Agent[]): AgentsResponse {
  return { clis };
}

const allowanceFixture: HostedAgentAllowance = {
  profile: 'stashbase-agent-default',
  remainingPercent: 80,
  inputTokens: 100,
  outputTokens: 50,
  cacheReadTokens: 10,
  windowStartedAt: '2026-09-01T00:00:00.000Z',
  windowEndsAt: '2026-09-08T00:00:00.000Z',
};

function fakePort(overrides: Partial<AgentRuntimePort> = {}): AgentRuntimePort {
  return {
    getAllowance: vi.fn(async () => allowanceFixture),
    listAgents: vi.fn(async () => catalog([])),
    prepareAgent: vi.fn(async () => catalog([])),
    resetManagedAgent: vi.fn(async () => catalog([])),
    updateDebug: vi.fn(async () => catalog([])),
    ...overrides,
  };
}

afterEach(cleanup);

describe('useAgentRuntimes', () => {
  it('polls every 500ms while a runtime is actively preparing, and stops once none are', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const installing = catalog([agent({ bootstrap: { phase: 'installing' } })]);
    const settled = catalog([agent({ bootstrap: { phase: 'ready' } })]);
    let calls = 0;
    const listAgents = vi.fn(async () => (calls++ === 0 ? installing : settled));
    const port = fakePort({ listAgents });
    renderHook(() => useAgentRuntimes(port), { wrapper: queryWrapper(queryClient) });

    await waitFor(() => expect(listAgents).toHaveBeenCalledTimes(2), { timeout: 2000 });
    // The second response has no agent mid-preparation, so the interval
    // should stop rescheduling: no third call should land.
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(listAgents).toHaveBeenCalledTimes(2);
  });

  it('leaves the allowance query disabled until a stashbase agent reports ready, then fires it', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const notReady = catalog([agent({ id: 'stashbase', bootstrap: { phase: 'installing' } })]);
    const ready = catalog([agent({ id: 'stashbase', bootstrap: { phase: 'ready' } })]);
    let calls = 0;
    const listAgents = vi.fn(async () => (calls++ === 0 ? notReady : ready));
    const getAllowance = vi.fn(async () => allowanceFixture);
    const port = fakePort({ listAgents, getAllowance });
    const view = renderHook(() => useAgentRuntimes(port), { wrapper: queryWrapper(queryClient) });

    await waitFor(() => expect(view.result.current.catalog.isSuccess).toBe(true));
    expect(getAllowance).not.toHaveBeenCalled();

    await waitFor(() => expect(listAgents).toHaveBeenCalledTimes(2), { timeout: 2000 });
    await waitFor(() => expect(getAllowance).toHaveBeenCalledTimes(1));
  });

  it('installs an agent and writes the response into the shared catalog cache', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const installed = catalog([agent({ bootstrap: { phase: 'ready' } })]);
    const prepareAgent = vi.fn(async () => installed);
    const port = fakePort({ prepareAgent });
    const view = renderHook(() => useAgentRuntimes(port), { wrapper: queryWrapper(queryClient) });

    act(() => view.result.current.install.mutate('codex'));

    await waitFor(() =>
      expect(prepareAgent).toHaveBeenCalledWith('codex', 'bootstrap', expect.anything()),
    );
    await waitFor(() =>
      expect(queryClient.getQueryData(agentCatalogQueryKeys.all)).toEqual(installed),
    );
  });

  it('logs in an agent and writes the response into the shared catalog cache', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const signedIn = catalog([agent({ bootstrap: { phase: 'ready' } })]);
    const prepareAgent = vi.fn(async () => signedIn);
    const port = fakePort({ prepareAgent });
    const view = renderHook(() => useAgentRuntimes(port), { wrapper: queryWrapper(queryClient) });

    act(() => view.result.current.login.mutate('claude'));

    await waitFor(() =>
      expect(prepareAgent).toHaveBeenCalledWith('claude', 'login', expect.anything()),
    );
    await waitFor(() =>
      expect(queryClient.getQueryData(agentCatalogQueryKeys.all)).toEqual(signedIn),
    );
  });

  it('uninstalls an agent and writes the response into the shared catalog cache', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const removed = catalog([]);
    const resetManagedAgent = vi.fn(async () => removed);
    const port = fakePort({ resetManagedAgent });
    const view = renderHook(() => useAgentRuntimes(port), { wrapper: queryWrapper(queryClient) });

    act(() => view.result.current.uninstall.mutate('codex'));

    await waitFor(() => expect(resetManagedAgent).toHaveBeenCalledWith('codex', expect.anything()));
    await waitFor(() =>
      expect(queryClient.getQueryData(agentCatalogQueryKeys.all)).toEqual(removed),
    );
  });

  it('updates debug settings and writes the response into the shared catalog cache', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const patched = catalog([]);
    const updateDebug = vi.fn(async () => patched);
    const port = fakePort({ updateDebug });
    const view = renderHook(() => useAgentRuntimes(port), { wrapper: queryWrapper(queryClient) });

    act(() => view.result.current.updateDebug.mutate({ discoveryPolicy: 'managed-only' }));

    await waitFor(() =>
      expect(updateDebug).toHaveBeenCalledWith(
        { discoveryPolicy: 'managed-only' },
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(queryClient.getQueryData(agentCatalogQueryKeys.all)).toEqual(patched),
    );
  });

  it('resets first run by pinning managed-only discovery before removing the managed install', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const calls: string[] = [];
    const removed = catalog([]);
    const port = fakePort({
      updateDebug: vi.fn(async () => {
        calls.push('updateDebug');
        return catalog([]);
      }),
      resetManagedAgent: vi.fn(async () => {
        calls.push('resetManagedAgent');
        return removed;
      }),
    });
    const view = renderHook(() => useAgentRuntimes(port), { wrapper: queryWrapper(queryClient) });

    act(() => view.result.current.resetFirstRun.mutate('codex'));

    await waitFor(() => expect(view.result.current.resetFirstRun.isSuccess).toBe(true));
    expect(port.updateDebug).toHaveBeenCalledWith(
      { discoveryPolicy: 'managed-only' },
      expect.anything(),
    );
    expect(calls).toEqual(['updateDebug', 'resetManagedAgent']);
    await waitFor(() =>
      expect(queryClient.getQueryData(agentCatalogQueryKeys.all)).toEqual(removed),
    );
  });
});
