import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
      details={
        <div
          className="max-w-full rounded-md bg-active px-2.5 py-2 font-mono text-caption break-all text-muted-foreground"
          title={entry?.path}
        >
          {entry?.path}
        </div>
      }
      failure={failure}
      onCancel={onCancel}
      onConfirm={onConfirm}
      open={entry !== null}
      pending={pending}
      title={entry?.kind === 'folder' ? 'Delete folder?' : 'Delete file?'}
    />
  );
}
