import { useCallback, useRef } from 'react';
import { api } from '../api';
import type { Action, CascadeDecision, CascadePrompt } from './state';

/**
 * Promise-backed modal prompts — the async replacements for
 * `window.alert` / `window.confirm` (which block the renderer thread in
 * Electron and steal focus) plus the rename-cascade dialog. Extracted
 * from AppProvider; each prompt is single-tracked: opening a new one
 * settles the previous resolver so it can't leak.
 */
export function useModals(dispatch: (a: Action) => void) {
  /** Promise resolver for the pending cascade dialog. Set when the
   *  rename action asks the user; cleared once they pick. */
  const cascadeResolveRef = useRef<((d: CascadeDecision) => void) | null>(null);

  const askCascade = useCallback((prompt: CascadePrompt): Promise<CascadeDecision> => {
    return new Promise<CascadeDecision>((resolve) => {
      // If a previous prompt is still open (shouldn't happen — rename
      // input is single-tracked), cancel it so we don't lose a
      // resolver in the ref.
      if (cascadeResolveRef.current) cascadeResolveRef.current('cancel');
      cascadeResolveRef.current = resolve;
      dispatch({ type: 'CASCADE_PROMPT', prompt });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveCascadePrompt = useCallback((decision: CascadeDecision) => {
    const r = cascadeResolveRef.current;
    cascadeResolveRef.current = null;
    dispatch({ type: 'CASCADE_PROMPT', prompt: null });
    if (r) r(decision);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modalResolveRef = useRef<((v: boolean) => void) | null>(null);

  const showAlert = useCallback((message: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (modalResolveRef.current) modalResolveRef.current(false);
      modalResolveRef.current = () => resolve();
      dispatch({ type: 'MODAL_OPEN', request: { type: 'alert', message } });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const askConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      if (modalResolveRef.current) modalResolveRef.current(false);
      modalResolveRef.current = resolve;
      dispatch({ type: 'MODAL_OPEN', request: { type: 'confirm', message } });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveModal = useCallback((value: boolean) => {
    const r = modalResolveRef.current;
    modalResolveRef.current = null;
    dispatch({ type: 'MODAL_CLOSE' });
    if (r) r(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Run the rename-preview probe, and if it surfaces cross-references,
   *  pop the cascade dialog. Encodes the decision tri-state once so the
   *  rename / move / folder-rename actions don't each spell it out:
   *
   *    `true`  → cascade-update links
   *    `false` → user wants to skip link updates but still rename
   *    `null`  → user cancelled; caller should bail without side effects
   *
   *  Preview-API failures are swallowed (treated as zero-hit). */
  const askCascadeForRename = useCallback(async (
    kind: 'file' | 'folder',
    oldPath: string,
    newPath: string,
  ): Promise<boolean | null> => {
    try {
      const preview = await api.renamePreview(kind, oldPath, newPath);
      if (preview.files === 0) return true;
      const decision = await askCascade({
        kind, oldPath, newPath,
        files: preview.files, links: preview.links,
      });
      if (decision === 'cancel') return null;
      return decision === 'update';
    } catch (err) {
      console.warn(`[${kind} rename] preview failed:`, err);
      return true;
    }
  }, [askCascade]);

  return { askCascade, resolveCascadePrompt, showAlert, askConfirm, resolveModal, askCascadeForRename };
}
