import { lazy, Suspense, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const BaseDialogModalShell = lazy(() => import('./BaseDialogModalShell'));

export interface ModalShellProps {
  onCancel: () => void;
  closeOnBackdrop?: boolean;
  wide?: boolean;
  top?: boolean;
  children: ReactNode;
}

/**
 * Shared Base UI dialog wrapper for the existing modal content. Backdrop
 * dismissal, focus handling, and interaction isolation are owned by the
 * maintained primitive; `wide` opts into the larger card style used by the
 * re-embed confirmation (which has cost stats to lay out).
 *
 * NOTE: Esc-to-dismiss is deliberately NOT owned here. A window-level
 * keydown on every mounted ModalShell would fire for ALL stacked
 * instances at once (e.g. a confirm dialog over the migration modal),
 * closing more than the topmost. Until there's a modal-stack that can
 * target only the top layer, modals keep their own input-focused Esc
 * handler (which only fires for the focused, topmost modal).
 *
 * Each modal still owns its own header / body / buttons.
 */
export function ModalShell(props: ModalShellProps) {
  return (
    <Suspense fallback={<ModalShellFallback {...props} />}>
      <BaseDialogModalShell {...props} />
    </Suspense>
  );
}

// The first open may race the asynchronously loaded Base UI primitive. Keep a
// minimal visual fallback so opening a modal never appears to fail; settled
// modals use Base UI's focus and interaction management.
function ModalShellFallback({
  onCancel,
  closeOnBackdrop = true,
  wide,
  top,
  children,
}: ModalShellProps) {
  return createPortal(
    <div
      className={'modal-veil' + (top ? ' top' : '')}
      role="presentation"
      onMouseDown={closeOnBackdrop ? (event) => {
        if (event.target === event.currentTarget) onCancel();
      } : undefined}
    >
      <div className={'modal-card' + (wide ? ' wide' : '')} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>,
    document.body,
  );
}
