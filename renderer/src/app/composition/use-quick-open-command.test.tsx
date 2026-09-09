import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createDocumentTabsRuntime } from '@/features/documents/public';
import { createWorkspaceRuntime } from '@/features/workspace/test-support';
import { documentTabsRuntimeOptions } from '@/test/fakes/documents';
import { workspaceRuntimeOptions } from '@/test/fakes/workspace';

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

/** One folder generation with its documents mounted — the pairing Quick Open
 *  is scoped to. */
function scope(path: string, generation: number) {
  return {
    documents: createDocumentTabsRuntime(
      documentTabsRuntimeOptions({ folderPath: path, generation }),
    ),
    workspace: createWorkspaceRuntime(
      workspaceRuntimeOptions({ folder: { name: 'Folder', path }, generation }),
    ),
  };
}

afterEach(() => {
  globalThis.document.body.replaceChildren();
});

describe('Quick Open command', () => {
  it('uses Cmd/Ctrl+P while leaving Cmd/Ctrl+O and Cmd/Ctrl+Shift+P unassigned', () => {
    const notes = scope('/library/notes', 1);
    const command = renderHook(() => useQuickOpenCommand(notes.workspace, notes.documents));

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
    const command = renderHook(() => useQuickOpenCommand(null, null));

    const quickOpen = dispatchShortcut('p', { metaKey: true });
    expect(quickOpen.defaultPrevented).toBe(true);
    expect(command.result.current.open).toBe(false);
  });

  it('closes on scope changes and restores focus to the initiating control', async () => {
    const initiator = globalThis.document.createElement('button');
    globalThis.document.body.append(initiator);
    initiator.focus();
    const notes = scope('/library/notes', 1);
    const writing = scope('/library/writing', 2);
    const command = renderHook(
      ({ open }: { open: ReturnType<typeof scope> }) =>
        useQuickOpenCommand(open.workspace, open.documents),
      { initialProps: { open: notes } },
    );

    act(() => {
      dispatchShortcut('p', { ctrlKey: true });
    });
    expect(command.result.current.open).toBe(true);
    command.rerender({ open: writing });

    await waitFor(() => expect(command.result.current.open).toBe(false));
    await waitFor(() => expect(globalThis.document.activeElement).toBe(initiator));

    act(() => command.result.current.close());
  });
});
