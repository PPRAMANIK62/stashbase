import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { EmbedderError } from '@/features/settings/application/embedder-port';
import { failureMessage } from '@/features/settings/application/failure-messages';
import { embedderPort, embedderState, keyedEmbedderState } from '@/test/fakes/settings';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { useEmbedder, useSearchKeyConfigured } from './use-embedder';

const initial = embedderState({ model: 'm' });

afterEach(cleanup);

function mount(port = embedderPort(initial)) {
  const hook = renderHook(() => useEmbedder(port), {
    wrapper: queryWrapper(createTestQueryClient()),
  });
  return { hook, port };
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

  it('writes the state a removal answers with instead of reading again', async () => {
    const cleared = embedderState({ model: 'cleared' });
    const port = embedderPort(keyedEmbedderState(), { removeKey: vi.fn(async () => cleared) });
    const { hook } = mount(port);
    await waitFor(() => expect(hook.result.current.state?.hasKey).toBe(true));

    act(() => hook.result.current.removeKey());

    await waitFor(() => expect(hook.result.current.state).toEqual(cleared));
    expect(port.load).toHaveBeenCalledTimes(1);
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
      removeKey: vi.fn(async (signal: AbortSignal) => {
        seen.set('removeKey', signal);
        return initial;
      }),
      saveKey: vi.fn(async (_provider, _key, signal: AbortSignal) => {
        seen.set('saveKey', signal);
        return { warning: null };
      }),
    });
    const { hook } = mount(port);

    act(() => hook.result.current.saveKey({ key: 'sk', provider: 'openai' }, vi.fn()));
    act(() => hook.result.current.removeKey());

    await waitFor(() => expect(seen.size).toBe(2));
    expect(seen.get('saveKey')?.aborted).toBe(false);
  });
});

describe('useSearchKeyConfigured', () => {
  it('is unknown until the source is read, then true only for the reader’s own key', async () => {
    const keyed = renderHook(() => useSearchKeyConfigured(embedderPort(keyedEmbedderState())), {
      wrapper: queryWrapper(createTestQueryClient()),
    });
    expect(keyed.result.current).toBeNull();
    await waitFor(() => expect(keyed.result.current).toBe(true));

    const differentProvider = renderHook(
      () => useSearchKeyConfigured(embedderPort(embedderState({ provider: 'openrouter' }))),
      { wrapper: queryWrapper(createTestQueryClient()) },
    );
    await waitFor(() => expect(differentProvider.result.current).toBe(false));
  });
});
