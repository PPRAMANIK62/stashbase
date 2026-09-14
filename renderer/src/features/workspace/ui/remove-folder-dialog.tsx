import { FolderMinus } from 'lucide-react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { displayFolderPath, folderName } from '@/features/workspace/domain/project';
import { PathChip } from '@/shared/ui/path-chip';

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
    <ConfirmDialog
      confirmLabel="Remove"
      description={
        <>
          StashBase will forget <span className="font-medium text-foreground">{name}</span> and
          clear its prepared and indexed data. The folder and its files will stay on disk.
        </>
      }
      details={<PathChip path={displayPath} title={folderPath ?? undefined} />}
      failure={failure}
      icon={FolderMinus}
      onCancel={onCancel}
      onConfirm={onConfirm}
      open={folderPath !== null}
      pending={pending}
      title="Remove this project?"
    />
  );
}
