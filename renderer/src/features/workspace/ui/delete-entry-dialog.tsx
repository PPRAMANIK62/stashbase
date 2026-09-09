import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { WorkspaceEntry } from '@/features/workspace/domain/tree';

export function DeleteEntryDialog({
  entry,
  failure,
  onCancel,
  onConfirm,
  pending,
}: {
  entry: WorkspaceEntry | null;
  failure: string | null;
  onCancel(): void;
  onConfirm(): void;
  pending: boolean;
}) {
  const name = entry ? entry.path.slice(entry.path.lastIndexOf('/') + 1) : '';

  return (
    <Dialog onOpenChange={(open) => !open && !pending && onCancel()} open={entry !== null}>
      <DialogContent closeDisabled={pending}>
        <DialogHeader>
          <DialogTitle>{entry?.kind === 'folder' ? 'Delete folder?' : 'Delete file?'}</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{name}</span>
            {entry?.kind === 'folder'
              ? ' and everything inside it will be deleted from disk. This cannot be undone.'
              : ' will be deleted from disk. This cannot be undone.'}
          </DialogDescription>
        </DialogHeader>
        <div
          className="max-w-full rounded-md bg-active px-2.5 py-2 font-mono text-caption break-all text-muted-foreground"
          title={entry?.path}
        >
          {entry?.path}
        </div>
        {failure && (
          <p className="mt-3 text-caption text-destructive" role="alert">
            {failure}
          </p>
        )}
        <DialogFooter>
          <Button disabled={pending} onClick={onCancel} variant="tertiary">
            Cancel
          </Button>
          <Button
            className="text-destructive hover:text-destructive"
            disabled={pending}
            leadingIcon={Trash2}
            loading={pending}
            onClick={onConfirm}
            variant="secondary"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
