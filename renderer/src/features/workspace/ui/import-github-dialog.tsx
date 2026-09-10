import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InputField, InputGroup } from '@/components/ui/input-group';
import type { GitHubImportView } from '@/features/workspace/hooks/use-github-import';

export interface ImportGitHubDialogProps {
  /** Where the copy would land, so the destination is a fact on screen rather
   *  than something the reader infers from the name field. */
  folderHome: string;
  import: GitHubImportView;
  onClose(): void;
  open: boolean;
}

/**
 * Import one public GitHub repository as a library folder.
 *
 * The URL and the destination name are refused inline by the same rules the
 * request will meet, so a reader is not told a URL is fine and then refused by
 * the server. Closing while a request is open cancels it; the server cleans
 * its own staging, and no partial member is left behind.
 */
export function ImportGitHubDialog({
  folderHome,
  import: request,
  onClose,
  open,
}: ImportGitHubDialogProps) {
  const close = () => {
    request.cancel();
    onClose();
  };

  const destination =
    request.folderName && !request.nameIssue
      ? `${folderHome}/${request.folderName}`
      : null;

  return (
    <Dialog onOpenChange={(next) => !next && close()} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from GitHub</DialogTitle>
          <DialogDescription>
            Copy a public repository into your library. The original is never changed.
          </DialogDescription>
        </DialogHeader>
        {/* One group, not two: the group is a proximity row, and a lone field
          * in its own group loses the reveal and reads as static text. */}
        <InputGroup className="w-full" size="compact">
          <InputField
            autoComplete="off"
            error={request.urlIssue ?? undefined}
            filled
            label="Repository URL"
            onChange={request.setUrl}
            placeholder="https://github.com/owner/repo"
            spellCheck={false}
            value={request.url}
          />
          <InputField
            autoComplete="off"
            error={request.nameIssue ?? undefined}
            filled
            label="Folder name"
            onChange={request.setFolderName}
            placeholder="repo"
            spellCheck={false}
            value={request.folderName}
          />
        </InputGroup>
        {/* The destination is a fact, so it is only stated once there is one.
          * Aligned to the field text rather than the dialog edge. */}
        {destination && (
          <p className="m-0 pl-2 text-caption text-muted-foreground">{destination}</p>
        )}
        {request.failure && (
          <p className="m-0 pl-2 text-caption text-destructive" role="alert">
            {request.failure.message}
          </p>
        )}
        <DialogFooter>
          <Button onClick={close} variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={!request.canSubmit}
            loading={request.pending}
            onClick={request.submit}
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
