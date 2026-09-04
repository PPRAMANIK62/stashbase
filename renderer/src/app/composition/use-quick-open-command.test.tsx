import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { useQuickOpenCommand } from './use-quick-open-command';

function dispatchShortcut(key: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key,
    ...options,
  });
  globalThis.document.dispatchEvent(event);
  return event;
}

afterEach(() => {
  globalThis.document.body.replaceChildren();
});

describe('Quick Open command', () => {
  it('uses Cmd/Ctrl+P while leaving Cmd/Ctrl+O and Cmd/Ctrl+Shift+P unassigned', () => {
    const command = renderHook(() => useQuickOpenCommand('/library/notes\u00001'));

    const openFile = dispatchShortcut('o', { ctrlKey: true });
    const commandPalette = dispatchShortcut('p', { ctrlKey: true, shiftKey: true });
    expect(openFile.defaultPrevented).toBe(false);
    expect(commandPalette.defaultPrevented).toBe(false);
    expect(command.result.current.open).toBe(false);

    let quickOpen: KeyboardEvent | undefined;
    act(() => {
      quickOpen = dispatchShortcut('p', { ctrlKey: true });
    });
    expect(quickOpen?.defaultPrevented).toBe(true);
    expect(command.result.current.open).toBe(true);
  });

  it('consumes the shortcut without opening when no folder scope is active', () => {
    const command = renderHook(() => useQuickOpenCommand(null));

    const quickOpen = dispatchShortcut('p', { metaKey: true });
    expect(quickOpen.defaultPrevented).toBe(true);
    expect(command.result.current.open).toBe(false);
  });

  it('closes on scope changes and restores focus to the initiating control', async () => {
    const initiator = globalThis.document.createElement('button');
    globalThis.document.body.append(initiator);
    initiator.focus();
    const command = renderHook(
      ({ scopeKey }: { scopeKey: string | null }) => useQuickOpenCommand(scopeKey),
      { initialProps: { scopeKey: '/library/notes\u00001' } },
    );

    act(() => {
      dispatchShortcut('p', { ctrlKey: true });
    });
    expect(command.result.current.open).toBe(true);
    command.rerender({ scopeKey: '/library/writing\u00002' });

    await waitFor(() => expect(command.result.current.open).toBe(false));
    await waitFor(() => expect(globalThis.document.activeElement).toBe(initiator));

    act(() => command.result.current.close());
  });
});
