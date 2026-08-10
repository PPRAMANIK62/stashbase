import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';

interface ClipboardImportDialogProps {
  title: ReactNode;
  description?: ReactNode;
  isTopmost: boolean;
  onCancel: () => void;
  onAdd: () => void;
  children: ReactNode;
}

/**
 * The clipboard-import dialog is lazy so the shadcn/Base UI stack loads only
 * when this optional prompt is opened. It stays separate from the legacy
 * shared shell so this foundation slice cannot change unrelated modal keyboard
 * or dismissal behavior.
 */
export default function ClipboardImportDialog({
  title,
  description,
  isTopmost,
  onCancel,
  onAdd,
  children,
}: ClipboardImportDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => {
      if (!open && isTopmost) onCancel();
    }}>
      <DialogContent className="!w-[min(420px,90vw)] !max-w-[90vw] !gap-0 border border-border bg-background !p-[22px_24px_20px] shadow-elevation" showCloseButton={false}>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription className="mt-0 mb-3.5 text-base leading-normal">{description}</DialogDescription>}
        {children}
        <div className="mt-3.5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Dismiss</Button>
          <Button type="button" autoFocus onClick={onAdd}>Add</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
