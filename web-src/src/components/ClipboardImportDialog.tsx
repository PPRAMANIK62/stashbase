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
  onCancel,
  onAdd,
  children,
}: ClipboardImportDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => {
      if (!open) onCancel();
    }}>
      <DialogContent className="modal-card !w-[min(420px,90vw)] !max-w-[90vw] !gap-0 !p-[22px_24px_20px]" showCloseButton={false}>
        <DialogTitle className="modal-title">{title}</DialogTitle>
        {description && <DialogDescription className="modal-hint">{description}</DialogDescription>}
        {children}
        <div className="modal-actions">
          <Button type="button" variant="outline" className="modal-btn" onClick={onCancel}>Dismiss</Button>
          <Button type="button" className="modal-btn primary" autoFocus onClick={onAdd}>Add</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
