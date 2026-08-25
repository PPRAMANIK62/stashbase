import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/common/components/ui/dialog';
import type { ModalShellProps } from '@/common/components/ModalShell';
import { cn } from '@/common/lib/utils';

export default function ManagedModalShell({
  title,
  description,
  onCancel,
  closeOnBackdrop = true,
  initialFocus,
  wide,
  narrow,
  children,
  isTopmost,
}: ModalShellProps & {
  isTopmost: boolean;
}) {
  // One width role off the overlay scale. `w-overlay-*` already carries
  // the viewport clamp, and DialogContent no longer ships a competing
  // responsive 384px cap to beat, so the `max-w-` half is gone.
  const widthClass = wide
    ? 'w-overlay-lg'
    : narrow
      ? 'w-overlay-sm'
      : 'w-overlay-md';
  return (
    <Dialog
      open
      disablePointerDismissal={!closeOnBackdrop}
      onOpenChange={(open) => {
        if (!open && isTopmost) onCancel();
      }}
    >
      <DialogContent
        className={cn(widthClass, 'border border-border px-6 pt-5 pb-5 shadow-elevation')}
        initialFocus={initialFocus}
        showCloseButton={false}
      >
        <DialogTitle className="text-base font-medium leading-snug">{title}</DialogTitle>
        {description !== undefined && (
          <DialogDescription className="mt-2 mb-3.5 text-base leading-normal [&_code]:font-mono [&_code]:text-sm [&_code]:text-accent">{description}</DialogDescription>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}
