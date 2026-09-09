import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { EmbedderError } from '@/features/settings/application/embedder-port';
import { failureMessage } from '@/features/settings/application/failure-messages';
import { embedderPort, embedderState } from '@/test/fakes/settings';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { useEmbedder } from './use-embedder';

const initial = embedderState({ model: 'm' });

afterEach(cleanup);

function mount(port = embedderPort(initial), openExternal = vi.fn()) {
  const hook = renderHook(() => useEmbedder(port, openExternal), {
    wrapper: queryWrapper(createTestQueryClient()),
  });
  return { hook, openExternal, port };
}

describe('useEmbedder', () => {
  it('reloads the state after a key is saved', async () => {
    const { hook, port } = mount();
    await waitFor(() => expect(hook.result.current.state).toEqual(initial));

    const saved = vi.fn();
    act(() => hook.result.current.saveKey({ key: 'sk', provider: 'openai' }, saved));

    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(port.saveKey).toHaveBeenCalledWith('openai', 'sk', expect.any(AbortSignal));
    await waitFor(() => expect(port.load).toHaveBeenCalledTimes(2));
  });

  it('opens the browser for a sign-in and tracks the flow until it completes', async () => {
    const port = embedderPort(initial, {
      signInStatus: vi.fn(async () => ({ state: 'complete' as const })),
    });
    const { hook, openExternal } = mount(port);
    await waitFor(() => expect(hook.result.current.state).toEqual(initial));

    act(() => hook.result.current.signIn());

    await waitFor(() =>
      expect(openExternal).toHaveBeenCalledWith('https://accounts.example/sign-in'),
    );
    await waitFor(() => expect(hook.result.current.signInPending).toBe(false));
    expect(port.signInStatus).toHaveBeenCalledWith('flow-1', expect.any(AbortSignal));
    await waitFor(() => expect(port.load).toHaveBeenCalledTimes(2));
  });

  it('keeps a failed sign-in visible as something the reader must act on', async () => {
    const port = embedderPort(initial, {
      signInStatus: vi.fn(async () => ({ error: 'Denied', state: 'error' as const })),
    });
    const { hook } = mount(port);

    act(() => hook.result.current.signIn());

    await waitFor(() =>
      expect(hook.result.current.accountFailure).toEqual({ message: 'Denied', tone: 'input' }),
    );
  });

  it('separates a rejected key from an unreachable one when reporting it', async () => {
    const rejecting = embedderPort(initial, {
      saveKey: vi.fn(async () => {
        throw new EmbedderError('rejected', 'HTTP 401 from the provider');
      }),
    });
    const first = mount(rejecting);
    act(() => first.hook.result.current.saveKey({ key: 'bad', provider: 'openai' }, vi.fn()));
    await waitFor(() =>
      expect(first.hook.result.current.keyFailure).toEqual({
        message: failureMessage('rejected'),
        tone: 'input',
      }),
    );

    const offline = embedderPort(initial, {
      removeKey: vi.fn(async () => {
        throw new EmbedderError('unavailable', 'StashBase is unavailable.');
      }),
    });
    const second = mount(offline);
    act(() => second.hook.result.current.removeKey());
    await waitFor(() =>
      expect(second.hook.result.current.keyFailure).toEqual({
        message: 'StashBase is unavailable.',
        tone: 'capability',
      }),
    );
  });

  it('gives each command its own abort lane, so one command cannot cancel another', async () => {
    const seen = new Map<string, AbortSignal>();
    const port = embedderPort(initial, {
      refreshAccount: vi.fn(async (signal: AbortSignal) => {
        seen.set('refreshAccount', signal);
        return initial.account;
      }),
      removeKey: vi.fn(async (signal: AbortSignal) => {
        seen.set('removeKey', signal);
        return initial;
      }),
    });
    const { hook } = mount(port);

    act(() => hook.result.current.refreshAccount());
    act(() => hook.result.current.removeKey());

    await waitFor(() => expect(seen.size).toBe(2));
    expect(seen.get('refreshAccount')?.aborted).toBe(false);
  });
});
