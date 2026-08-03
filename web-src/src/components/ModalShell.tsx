import { type ReactNode } from 'react';
import { Dialog } from '@base-ui/react/dialog';

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
export function ModalShell({
  onCancel,
  closeOnBackdrop = true,
  wide,
  top,
  children,
}: {
  onCancel: () => void;
  closeOnBackdrop?: boolean;
  wide?: boolean;
  top?: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open
      disablePointerDismissal={!closeOnBackdrop}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={'modal-backdrop' + (top ? ' top' : '')} />
        <Dialog.Viewport className={'modal-veil modal-dialog-viewport' + (top ? ' top' : '')}>
          <Dialog.Popup className={'modal-card' + (wide ? ' wide' : '')}>
            {children}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
