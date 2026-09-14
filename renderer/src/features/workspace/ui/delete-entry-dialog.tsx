import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { WorkspaceEntry } from '@/features/workspace/domain/tree';
import { PathChip } from '@/shared/ui/path-chip';
import { basePathName } from '@/shared/utils/file-path';

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
  const name = entry ? basePathName(entry.path) : '';

  return (
    <ConfirmDialog
      confirmLabel="Delete"
      description={
        <>
          <span className="font-medium text-foreground">{name}</span>
          {entry?.kind === 'folder'
            ? ' and everything inside it will be deleted from disk. This cannot be undone.'
            : ' will be deleted from disk. This cannot be undone.'}
        </>
      }
      destructive
      details={entry && <PathChip path={entry.path} />}
      failure={failure}
      onCancel={onCancel}
      onConfirm={onConfirm}
      open={entry !== null}
      pending={pending}
      title={entry?.kind === 'folder' ? 'Delete folder?' : 'Delete file?'}
    />
  );
}
