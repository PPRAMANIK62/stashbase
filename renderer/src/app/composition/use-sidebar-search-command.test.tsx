import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { useSidebarSearchCommand } from './use-sidebar-search-command';

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

afterEach(() => globalThis.document.body.replaceChildren());

describe('sidebar Search command', () => {
  it('opens general Search with Cmd/Ctrl+Shift+F without taking document Find', () => {
    const openSearch = vi.fn();
    renderHook(() => useSidebarSearchCommand(true, openSearch));

    expect(dispatchShortcut('f', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(openSearch).not.toHaveBeenCalled();

    act(() => {
      expect(dispatchShortcut('f', { ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(true);
      dispatchShortcut('F', { metaKey: true, shiftKey: true });
    });
    expect(openSearch).toHaveBeenCalledTimes(2);
  });

  it('reserves the general shortcut while Search is unavailable', () => {
    const openSearch = vi.fn();
    renderHook(() => useSidebarSearchCommand(false, openSearch));

    expect(dispatchShortcut('f', { metaKey: true, shiftKey: true }).defaultPrevented).toBe(true);
    expect(openSearch).not.toHaveBeenCalled();
  });
});
