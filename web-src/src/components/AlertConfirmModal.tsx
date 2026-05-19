/**
 * Themed replacement for `window.alert` / `window.confirm`. Renders
 * inside the app's `ModalShell` so it inherits the same backdrop /
 * card styling as every other modal — no jarring jump to the OS's
 * default dialog, no focus-stealing block of the Electron renderer
 * thread.
 *
 * State lives in `AppContext.state.modal`; the open/resolve API is
 * `actions.alert(msg)` / `actions.confirm(msg)` (both Promise-based).
 */
import { useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { ModalShell } from './ModalShell';

export function AlertConfirmModal() {
  const { state, actions } = useApp();
  const okBtnRef = useRef<HTMLButtonElement | null>(null);

  // Auto-focus the primary button on open so Enter / Esc work without
  // a mouse click. Matches macOS dialog conventions.
  useEffect(() => {
    if (state.modal) okBtnRef.current?.focus();
  }, [state.modal]);

  if (!state.modal) return null;

  const isConfirm = state.modal.type === 'confirm';
  const cancel = () => actions.resolveModal(false);
  const ok = () => actions.resolveModal(true);

  return (
    <ModalShell onCancel={cancel}>
      <p className="modal-hint">{state.modal.message}</p>
      <div className="modal-actions">
        {isConfirm && (
          <button type="button" className="modal-btn" onClick={cancel}>
            Cancel
          </button>
        )}
        <button
          ref={okBtnRef}
          type="button"
          className="modal-btn primary"
          onClick={ok}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && isConfirm) { e.preventDefault(); cancel(); }
          }}
        >
          {isConfirm ? 'Confirm' : 'OK'}
        </button>
      </div>
    </ModalShell>
  );
}
