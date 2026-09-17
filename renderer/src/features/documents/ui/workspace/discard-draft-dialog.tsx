/**
 * The question a close has to ask when the draft's file is gone.
 *
 * Saving cannot settle this tab, so the close is not a save-or-nothing
 * decision the app can make quietly: either the text goes, or the tab stays.
 * The reader is the only one who can choose, and the tab stays open behind the
 * question so the work is on screen while they do.
 */
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { SourceReference } from '@/shared/domain/source-reference';
import { PathChip } from '@/shared/ui/path-chip';
import { basePathName } from '@/shared/utils/file-path';

export function DiscardDraftDialog({
  onCancel,
  onConfirm,
  source,
}: {
  onCancel(): void;
  onConfirm(): void;
  /** The tab the close is about, or null when nothing is being closed. */
  source: SourceReference | null;
}) {
  return (
    <ConfirmDialog
      confirmLabel="Close without saving"
      description={
        <>
          The source file for{' '}
          <span className="font-medium text-foreground">
            {source ? basePathName(source.path) : ''}
          </span>{' '}
          is gone, so this draft cannot be saved. Closing discards it, and that cannot be undone.
          Restore file, on the document itself, writes it back to its old path instead.
        </>
      }
      destructive
      details={source && <PathChip path={source.path} />}
      onCancel={onCancel}
      onConfirm={onConfirm}
      open={source !== null}
      title="Close without saving?"
    />
  );
}
