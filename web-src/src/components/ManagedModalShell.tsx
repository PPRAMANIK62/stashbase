import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog';
import type { ModalShellProps } from './ModalShell';

export default function ManagedModalShell({
  title,
  description,
  onCancel,
  closeOnBackdrop = true,
  initialFocus,
  wide,
  top,
  children,
  isTopmost,
}: ModalShellProps & {
  isTopmost: boolean;
}) {
  return (
    <Dialog
      open
      disablePointerDismissal={!closeOnBackdrop}
      onOpenChange={(open) => {
        if (!open && isTopmost) onCancel();
      }}
    >
      <DialogContent
        className={`modal-card !max-w-[92vw] !gap-0${wide ? ' wide' : ''}${top ? ' !z-[10001]' : ''}`}
        overlayClassName={top ? 'top !z-[10000]' : undefined}
        initialFocus={initialFocus}
        showCloseButton={false}
      >
        <DialogTitle className="modal-title">{title}</DialogTitle>
        {description !== undefined && (
          <DialogDescription className="modal-hint">{description}</DialogDescription>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}
