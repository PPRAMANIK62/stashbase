import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { failureMessage } from '@/features/settings/application/failure-messages';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { useSettingsCommand } from './use-settings-command';

afterEach(cleanup);

const noop = () => undefined;

/** A call that never settles on its own, so a test decides when it does. */
function heldCall() {
  const signals: AbortSignal[] = [];
  let release: () => void = noop;
  const settled = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    call: vi.fn(async (_input: void, signal: AbortSignal) => {
      signals.push(signal);
      await settled;
    }),
    release,
    signals,
  };
}

function render(call: (input: void, signal: AbortSignal) => Promise<void>) {
  return renderHook(() => useSettingsCommand('write', call), {
    wrapper: queryWrapper(createTestQueryClient()),
  });
}

describe('useSettingsCommand', () => {
  it('aborts the call already running under the same lane before starting the next', async () => {
    const held = heldCall();
    const hook = render(held.call);

    act(() => hook.result.current.run());
    await waitFor(() => expect(held.signals).toHaveLength(1));
    act(() => hook.result.current.run());
    await waitFor(() => expect(held.signals).toHaveLength(2));

    expect(held.signals[0]?.aborted).toBe(true);
    expect(held.signals[1]?.aborted).toBe(false);
    held.release();
  });

  it('aborts what is still open when the panel that owns it goes away', async () => {
    const held = heldCall();
    const hook = render(held.call);

    act(() => hook.result.current.run());
    await waitFor(() => expect(held.signals).toHaveLength(1));
    hook.unmount();

    expect(held.signals[0]?.aborted).toBe(true);
    held.release();
  });

  it('reads a refusal as the ladder sentence and tone, never what it was thrown with', async () => {
    const hook = render(
      vi.fn(async () => {
        throw new Error('EPIPE writing to the daemon socket');
      }),
    );

    act(() => hook.result.current.run());

    await waitFor(() =>
      expect(hook.result.current.failure).toEqual({
        message: failureMessage('unavailable'),
        tone: 'capability',
      }),
    );
    expect(hook.result.current.busy).toBe(false);
  });

  it('hands a caller its own completion the answer the command settled with', async () => {
    const hook = renderHook(() => useSettingsCommand('write', async (input: number) => input * 2), {
      wrapper: queryWrapper(createTestQueryClient()),
    });
    const done = vi.fn();

    act(() => hook.result.current.run(21, done));

    await waitFor(() => expect(done).toHaveBeenCalledWith(42));
    expect(hook.result.current.result).toBe(42);
  });
});
