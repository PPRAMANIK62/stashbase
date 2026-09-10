import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { useCommandSurface } from './use-command-surface';

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

/** The focus restore is deferred a microtask past the close, so the overlay
 *  has finished unmounting before the caret is put back. */
const settle = () => act(async () => undefined);

function focusedButton(): HTMLButtonElement {
  const button = document.createElement('button');
  document.body.append(button);
  button.focus();
  return button;
}

describe('useCommandSurface', () => {
  it('starts closed', () => {
    const { result } = renderHook(() => useCommandSurface());

    expect(result.current.open).toBe(false);
  });

  it('opens on present and closes on close', () => {
    const { result } = renderHook(() => useCommandSurface());

    act(() => result.current.present());
    expect(result.current.open).toBe(true);

    act(() => result.current.close());
    expect(result.current.open).toBe(false);
  });

  it('returns focus to the element that summoned it', async () => {
    const opener = focusedButton();
    const { result } = renderHook(() => useCommandSurface());

    act(() => result.current.present());
    document.body.focus();
    act(() => result.current.close());
    await settle();

    expect(document.activeElement).toBe(opener);
  });

  it('restores focus when the holder unmounts while open', async () => {
    const opener = focusedButton();
    const { result, unmount } = renderHook(() => useCommandSurface());

    act(() => result.current.present());
    document.body.focus();
    unmount();
    await settle();

    expect(document.activeElement).toBe(opener);
  });

  it('leaves focus alone when the opener has been removed', async () => {
    const opener = focusedButton();
    const { result } = renderHook(() => useCommandSurface());

    act(() => result.current.present());
    opener.remove();
    act(() => result.current.close());
    await settle();

    expect(document.activeElement).toBe(document.body);
  });

  it('restores only once, so a second close cannot steal focus back', async () => {
    const opener = focusedButton();
    const { result } = renderHook(() => useCommandSurface());

    act(() => result.current.present());
    act(() => result.current.close());
    await settle();

    const other = focusedButton();
    act(() => result.current.close());
    await settle();

    expect(document.activeElement).toBe(other);
    expect(opener.isConnected).toBe(true);
  });
});
