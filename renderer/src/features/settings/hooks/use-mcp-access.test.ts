import type { QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { failureMessage } from '@/features/settings/application/failure-messages';
import type { McpAccessPort } from '@/features/settings/application/ports';
import type { McpHttpAccess } from '@/features/settings/domain/mcp-access';
import { mcpAccess, mcpAccessPort, mcpHttpAccess } from '@/test/fakes/settings';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { MCP_COPY_FAILED, useMcpAccess } from './use-mcp-access';

interface Deferred<T> {
  readonly promise: Promise<T>;
  reject(reason: unknown): void;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  const handles: { fail?: (reason: unknown) => void; settle?: (value: T) => void } = {};
  const promise = new Promise<T>((onValue, onReason) => {
    handles.settle = onValue;
    handles.fail = onReason;
  });
  return {
    promise,
    reject: (reason) => handles.fail?.(reason),
    resolve: (value) => handles.settle?.(value),
  };
}

function mount(port: McpAccessPort, client: QueryClient = createTestQueryClient()) {
  return renderHook(() => useMcpAccess(port), { wrapper: queryWrapper(client) });
}

/** A refused write reaches its rollback before its own state turns to error,
 *  so "no write is open" is the point past which nothing more can land. */
async function allWritesSettled(client: QueryClient): Promise<void> {
  await waitFor(() =>
    expect(
      client
        .getMutationCache()
        .getAll()
        .some((mutation) => mutation.state.status === 'pending'),
    ).toBe(false),
  );
}

function stubClipboard(writeText: (text: string) => Promise<void>): void {
  vi.stubGlobal('navigator', { clipboard: { writeText } });
}

afterEach(cleanup);

describe('useMcpAccess', () => {
  it('moves the Docker opt-in before the server answers, then takes its snapshot', async () => {
    const answer = deferred<McpHttpAccess>();
    let served = mcpHttpAccess();
    const port = mcpAccessPort({
      setDockerAccess: vi.fn(() => answer.promise),
      status: vi.fn(async () => mcpAccess({ http: served })),
    });
    const hook = mount(port);
    await waitFor(() => expect(hook.result.current.access).not.toBeNull());

    act(() => hook.result.current.setDockerAccess(true));

    await waitFor(() => expect(hook.result.current.dockerState).toBe('starting'));
    expect(hook.result.current.access?.http.dockerAccess).toBe(true);
    expect(hook.result.current.busy).toBe(true);

    served = mcpHttpAccess({ dockerAccess: true, dockerActive: true });
    await act(async () => {
      answer.resolve(served);
      await answer.promise;
    });

    await waitFor(() => expect(hook.result.current.dockerState).toBe('active'));
    expect(port.status).toHaveBeenCalledTimes(1);
  });

  it('puts the opt-in back where it was when the write refuses', async () => {
    const answer = deferred<McpHttpAccess>();
    const port = mcpAccessPort({ setDockerAccess: vi.fn(() => answer.promise) });
    const hook = mount(port);
    await waitFor(() => expect(hook.result.current.access).not.toBeNull());

    act(() => hook.result.current.setDockerAccess(true));
    await waitFor(() => expect(hook.result.current.access?.http.dockerAccess).toBe(true));

    await act(async () => {
      answer.reject(new Error('offline'));
      await expect(answer.promise).rejects.toThrow('offline');
    });

    await waitFor(() => expect(hook.result.current.access?.http.dockerAccess).toBe(false));
    expect(hook.result.current.dockerState).toBe('off');
    expect(hook.result.current.failure).toEqual({
      message: failureMessage('unavailable'),
      tone: 'capability',
    });
    // The refusal itself put the value back; no re-read was waited on.
    expect(port.status).toHaveBeenCalledTimes(1);
  });

  it('ignores the rollback of a write a newer one has already answered', async () => {
    const first = deferred<McpHttpAccess>();
    const second = deferred<McpHttpAccess>();
    let attempts = 0;
    let served = mcpHttpAccess();
    const port = mcpAccessPort({
      setDockerAccess: vi.fn(() => {
        attempts += 1;
        return attempts === 1 ? first.promise : second.promise;
      }),
      status: vi.fn(async () => mcpAccess({ http: served })),
    });
    const client = createTestQueryClient();
    const hook = mount(port, client);
    await waitFor(() => expect(hook.result.current.access).not.toBeNull());

    act(() => hook.result.current.setDockerAccess(true));
    await waitFor(() => expect(hook.result.current.access?.http.dockerAccess).toBe(true));
    act(() => hook.result.current.setDockerAccess(true));
    await waitFor(() => expect(port.setDockerAccess).toHaveBeenCalledTimes(2));

    served = mcpHttpAccess({ dockerAccess: true, dockerActive: true });
    await act(async () => {
      second.resolve(served);
      await second.promise;
    });
    await waitFor(() => expect(hook.result.current.dockerState).toBe('active'));

    await act(async () => {
      first.reject(new Error('offline'));
      await expect(first.promise).rejects.toThrow('offline');
    });
    await allWritesSettled(client);

    expect(hook.result.current.dockerState).toBe('active');
    expect(hook.result.current.access?.http.dockerAccess).toBe(true);
  });

  it('copies the token and says so', async () => {
    const writeText = vi.fn(async () => undefined);
    stubClipboard(writeText);
    const hook = mount(mcpAccessPort());
    await waitFor(() => expect(hook.result.current.access).not.toBeNull());

    act(() => hook.result.current.copy('token'));

    await waitFor(() => expect(hook.result.current.copied).toBe('token'));
    expect(writeText).toHaveBeenCalledWith('token-abc');
    expect(hook.result.current.failure).toBeNull();
  });

  it('tells the reader to copy by hand when the clipboard refuses', async () => {
    stubClipboard(
      vi.fn(async () => {
        throw new Error('denied');
      }),
    );
    const hook = mount(mcpAccessPort());
    await waitFor(() => expect(hook.result.current.access).not.toBeNull());

    act(() => hook.result.current.copy('token'));

    await waitFor(() =>
      expect(hook.result.current.failure).toEqual({ message: MCP_COPY_FAILED, tone: 'input' }),
    );
    expect(hook.result.current.copied).toBeNull();
  });
});
