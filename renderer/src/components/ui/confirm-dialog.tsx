/** The dialog that asks before an irreversible action: a question, its
 *  consequence, and two buttons.
 *
 *  Every such dialog in the app is this shape, so the shape is written once —
 *  including the part that is easy to get wrong. A refusal stays INSIDE the
 *  panel rather than closing over the reader's question, and while the action
 *  is in flight neither button, nor the close control, nor a click outside can
 *  take the panel away underneath it. */

'use client';

import { Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  /** What the confirm button says. Name the action, not "OK". */
  confirmLabel: string;
  /** @default "Cancel" */
  cancelLabel?: string;
  /** What the action will do, in the reader's terms. */
  description: ReactNode;
  /** Whether the action destroys something. Marks the confirm accordingly. */
  destructive?: boolean;
  /** Anything the question needs to show between its description and the
   *  buttons — the path about to be deleted, a preview of what is affected. */
  details?: ReactNode;
  /** What the last attempt refused with, or null. Shown in place. */
  failure?: string | null;
  /** Whether the action is in flight. Holds the panel open and disables it. */
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: ReactNode;
}

export function ConfirmDialog({
  cancelLabel = 'Cancel',
  confirmLabel,
  description,
  destructive = false,
  details,
  failure = null,
  onCancel,
  onConfirm,
  open,
  pending = false,
  title,
}: ConfirmDialogProps) {
  const confirmProps = destructive
    ? {
        className: 'text-destructive hover:text-destructive',
        leadingIcon: Trash2,
        variant: 'secondary' as const,
      }
    : { variant: 'primary' as const };

  return (
    <Dialog onOpenChange={(next) => !next && !pending && onCancel()} open={open}>
      <DialogContent closeDisabled={pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {details}
        {failure && (
          <p
            className={cn(details ? 'mt-3' : 'mt-1', 'text-caption text-destructive')}
            role="alert"
          >
            {failure}
          </p>
        )}
        <DialogFooter>
          <Button disabled={pending} onClick={onCancel} variant="tertiary">
            {cancelLabel}
          </Button>
          <Button {...confirmProps} loading={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
