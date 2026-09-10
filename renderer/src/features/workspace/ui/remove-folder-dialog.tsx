import { FolderMinus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { displayFolderPath, folderName } from '@/features/workspace/domain/library';

export interface RemoveFolderDialogProps {
  failure: string | null;
  folderPath: string | null;
  homeDirectory: string;
  pending: boolean;
  onCancel(): void;
  onConfirm(): void;
}

export function RemoveFolderDialog({
  failure,
  folderPath,
  homeDirectory,
  pending,
  onCancel,
  onConfirm,
}: RemoveFolderDialogProps) {
  const name = folderPath ? folderName(folderPath) : '';
  const displayPath = folderPath ? displayFolderPath(folderPath, homeDirectory) : '';

  return (
    <Dialog
      open={folderPath !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onCancel();
      }}
    >
      <DialogContent closeDisabled={pending}>
        <DialogHeader>
          <div className="mb-1 flex size-8 items-center justify-center rounded-full bg-hover text-foreground">
            <FolderMinus aria-hidden="true" className="size-4" />
          </div>
          <DialogTitle>Remove from Library?</DialogTitle>
          <DialogDescription>
            StashBase will forget <span className="font-medium text-foreground">{name}</span> and
            clear its prepared and indexed data. The folder and its files will stay on disk.
          </DialogDescription>
        </DialogHeader>

        <div
          className="max-w-full rounded-md bg-active px-2.5 py-2 font-mono text-caption break-all text-muted-foreground"
          title={folderPath ?? undefined}
        >
          {displayPath}
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
          <Button loading={pending} onClick={onConfirm} variant="primary">
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
