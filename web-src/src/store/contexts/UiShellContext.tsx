/**
 * UI-shell slice: the cross-cutting overlay/blocking states — context menu,
 * inline rename, the rename-cascade prompt, the alert/confirm modal, and
 * in-document Find. See the slice map atop `state.ts` for why `ctxMenu` and
 * `renaming` (workspace/tree in origin) live here rather than in
 * `WorkspaceContext`: the rest of the app already treats them as one
 * "something is blocking" group alongside `modal` / `cascadePrompt`.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { State } from '../state/state';

export interface UiShellState {
  ctxMenu: State['ctxMenu'];
  renaming: State['renaming'];
  cascadePrompt: State['cascadePrompt'];
  modal: State['modal'];
  find: State['find'];
}

export const UiShellContext = createContext<UiShellState | null>(null);

export function UiShellProvider({ state, children }: { state: State; children: ReactNode }) {
  const value = useMemo<UiShellState>(() => ({
    ctxMenu: state.ctxMenu,
    renaming: state.renaming,
    cascadePrompt: state.cascadePrompt,
    modal: state.modal,
    find: state.find,
  }), [state.ctxMenu, state.renaming, state.cascadePrompt, state.modal, state.find]);
  return <UiShellContext.Provider value={value}>{children}</UiShellContext.Provider>;
}

export function useUiShell(): UiShellState {
  const ctx = useContext(UiShellContext);
  if (!ctx) throw new Error('useUiShell must be used inside <UiShellProvider>');
  return ctx;
}
