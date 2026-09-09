import { useCallback, useLayoutEffect, useRef } from 'react';

import type { DocumentTabsRuntime } from '@/features/documents/public';
import type { WorkspaceRuntime } from '@/features/workspace/public';
import { useCommandSurface, type CommandSurface } from '@/lib/runtime/use-command-surface';

import { useWindowCommand } from './use-window-command';

function isQuickOpenShortcut(event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === 'p' &&
    (event.metaKey || event.ctrlKey) &&
    !event.shiftKey &&
    !event.altKey
  );
}

/** Quick open is scoped to one folder generation with its documents mounted;
 *  the key identifies that pairing, so leaving it closes the surface. */
function quickOpenScopeKey(
  workspace: WorkspaceRuntime | null,
  documents: DocumentTabsRuntime | null,
): string | null {
  if (!workspace || !documents) return null;
  return `${workspace.scope.folder.path}#${workspace.scope.generation}`;
}

export function useQuickOpenCommand(
  workspace: WorkspaceRuntime | null,
  documents: DocumentTabsRuntime | null,
): Pick<CommandSurface, 'close' | 'open'> {
  const scopeKey = quickOpenScopeKey(workspace, documents);
  const { close, open, present } = useCommandSurface();
  const previousScopeKey = useRef(scopeKey);

  useLayoutEffect(() => {
    if (previousScopeKey.current === scopeKey) return;
    previousScopeKey.current = scopeKey;
    close();
  }, [close, scopeKey]);

  useWindowCommand(
    isQuickOpenShortcut,
    useCallback(() => {
      if (!scopeKey || open || globalThis.document.querySelector('[role="dialog"]')) return;
      present();
    }, [open, present, scopeKey]),
  );

  return { close, open };
}
