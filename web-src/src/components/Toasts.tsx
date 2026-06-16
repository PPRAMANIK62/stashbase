import { useEffect } from 'react';
import type { Toast as ToastModel } from '../store/state';
import { useApp } from '../store/AppContext';

/**
 * Bottom-right stack of toast notifications. Auto-dismiss is owned by
 * each `<ToastItem>` so removing one doesn't reset the timer for the
 * others (a single shared interval would do this and looks bad on
 * rapid-fire toasts).
 *
 * Use via `actions.toast(message, opts?)` from anywhere; this
 * component just renders whatever is in `state.toasts`.
 */
export function Toasts() {
  const { state, actions } = useApp();
  if (state.toasts.length === 0) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {state.toasts.length > 1 && (
        <button
          type="button"
          className="toast-clear-all"
          onClick={() => actions.clearToasts()}
        >
          Clear all ({state.toasts.length})
        </button>
      )}
      {/* The scroll lives on this inner box, not the stack, so toasts
          scroll *under their own top edge* and never slide behind the
          (outside-the-scroll) Clear all button. */}
      <div className="toast-scroll">
        {state.toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => actions.dismissToast(t.id)} />
        ))}
      </div>
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastModel; onDismiss: () => void }) {
  // Per-toast auto-dismiss timer. `ttl: null` toasts (errors by
  // default) skip this and only go away when the user clicks ×.
  useEffect(() => {
    if (toast.ttl == null) return;
    const t = setTimeout(onDismiss, toast.ttl);
    return () => clearTimeout(t);
    // Re-arm on ttl + id, and on count so a fresh duplicate (which
    // bumps count in place) restarts the auto-dismiss instead of
    // letting the original timer expire under it.
  }, [toast.ttl, toast.id, toast.count, onDismiss]);

  const count = toast.count ?? 1;
  return (
    <div className={`toast toast-${toast.level}`} role="alert">
      <span className="toast-msg">{toast.message}</span>
      {count > 1 && <span className="toast-count">×{count}</span>}
      {toast.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            toast.action!.onClick();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        className="toast-close"
        title="Dismiss"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}
