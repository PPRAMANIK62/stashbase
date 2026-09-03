import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentNavigationRuntime } from '@/features/documents/public';

import { useDocumentCommands } from './use-document-commands';

function dispatchCommand(key: string, options: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    key,
    ...options,
  });
  globalThis.document.dispatchEvent(event);
  return event;
}

describe('document commands composition', () => {
  it('routes Find shortcuts to the active document navigation runtime', () => {
    const runtime = createDocumentNavigationRuntime('tab-1');
    const controller = {
      close: vi.fn(),
      next: vi.fn(() => ({ current: 2, total: 2 })),
      previous: vi.fn(() => ({ current: 1, total: 2 })),
      setQuery: vi.fn(() => ({ current: 1, total: 2 })),
    };
    runtime.claimFind('tab-1', Symbol('find'), controller);
    const { unmount } = renderHook(() => useDocumentCommands(runtime));

    expect(dispatchCommand('f').defaultPrevented).toBe(true);
    expect(runtime.store.getState().find.open).toBe(true);
    expect(dispatchCommand('g').defaultPrevented).toBe(true);
    expect(controller.next).toHaveBeenCalledOnce();
    dispatchCommand('g', { shiftKey: true });
    expect(controller.previous).toHaveBeenCalledOnce();

    const escape = dispatchCommand('Escape', { ctrlKey: false });
    expect(escape.defaultPrevented).toBe(true);
    expect(controller.close).toHaveBeenCalledOnce();
    expect(runtime.store.getState().find.open).toBe(false);

    unmount();
    runtime.dispose();
  });
});
