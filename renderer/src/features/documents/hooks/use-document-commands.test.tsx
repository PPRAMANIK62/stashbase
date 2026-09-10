import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentTabsRuntime } from '@/features/documents/public';
import { documentTabsRuntimeOptions } from '@/test/fakes/documents';

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
    // The navigation runtime is reached the way the shell reaches it: through
    // the tabs runtime that owns it.
    const tabs = createDocumentTabsRuntime(
      documentTabsRuntimeOptions({
        restored: {
          activeTabId: 'tab-1',
          tabs: [{ id: 'tab-1', source: { folderPath: '/library/notes', path: 'plan.md' } }],
        },
      }),
    );
    const runtime = tabs.navigation;
    const controller = {
      close: vi.fn(),
      next: vi.fn(() => ({ current: 2, total: 2 })),
      previous: vi.fn(() => ({ current: 1, total: 2 })),
      setQuery: vi.fn(() => ({ current: 1, total: 2 })),
    };
    runtime.claimFind('tab-1', Symbol('find'), controller);
    const { unmount } = renderHook(() => useDocumentCommands(runtime));

    expect(dispatchCommand('f').defaultPrevented).toBe(true);
    // Find is open, so the step chord is taken and reaches the controller.
    expect(dispatchCommand('g').defaultPrevented).toBe(true);
    expect(controller.next).toHaveBeenCalledOnce();
    dispatchCommand('g', { shiftKey: true });
    expect(controller.previous).toHaveBeenCalledOnce();

    const escape = dispatchCommand('Escape', { ctrlKey: false });
    expect(escape.defaultPrevented).toBe(true);
    expect(controller.close).toHaveBeenCalledOnce();
    // Find is closed, so the step chord falls through untouched.
    expect(dispatchCommand('g').defaultPrevented).toBe(false);
    expect(controller.next).toHaveBeenCalledOnce();

    unmount();
    tabs.dispose();
  });

  it('closes the active document tab on Cmd/Ctrl+W and always keeps the chord', async () => {
    const tabs = createDocumentTabsRuntime(
      documentTabsRuntimeOptions({
        createId: () => 'tab-2',
        restored: {
          activeTabId: 'tab-1',
          tabs: [{ id: 'tab-1', source: { folderPath: '/library/notes', path: 'plan.md' } }],
        },
      }),
    );
    const close = vi.spyOn(tabs, 'close');
    const { unmount } = renderHook(() => useDocumentCommands(tabs.navigation, tabs));

    // The chord is caught at the document root, so it works with focus
    // anywhere in the window, including inside the document's own editor.
    const editor = globalThis.document.createElement('textarea');
    globalThis.document.body.append(editor);
    editor.focus();
    const fromEditor = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: 'w',
    });
    editor.dispatchEvent(fromEditor);
    expect(fromEditor.defaultPrevented).toBe(true);
    expect(close).toHaveBeenCalledWith('tab-1');
    await vi.waitFor(() => expect(tabs.openSources()).toEqual([]));
    editor.remove();

    expect(dispatchCommand('w').defaultPrevented).toBe(true);
    expect(close).toHaveBeenCalledOnce();
    expect(dispatchCommand('w', { shiftKey: true }).defaultPrevented).toBe(false);

    unmount();
    tabs.dispose();
  });
});
