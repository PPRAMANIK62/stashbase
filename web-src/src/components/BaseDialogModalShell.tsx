import { Dialog } from '@base-ui/react/dialog';
import type { ModalShellProps } from './ModalShell';

/**
 * Async Base UI implementation for shared dialogs. Keeping this boundary
 * dynamic preserves the renderer's startup budget while every settled modal
 * receives the primitive's focus and dismissal handling.
 */
export default function BaseDialogModalShell({
  onCancel,
  closeOnBackdrop = true,
  wide,
  top,
  children,
}: ModalShellProps) {
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
