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
import type { GitHubImportView } from '@/features/workspace/hooks/use-project-entry';
import { FailureNotice } from '@/shared/ui/failure-notice';

export interface ImportGitHubDialogProps {
  import: GitHubImportView;
  onClose(): void;
  open: boolean;
}

/**
 * Import one public GitHub repository as a project folder.
 *
 * The URL and the destination name are refused inline by the same rules the
 * request will meet, so a reader is not told a URL is fine and then refused by
 * the server. Closing while a request is open cancels it; the server cleans
 * its own staging, and no partial member is left behind.
 */
export function ImportGitHubDialog({ import: request, onClose, open }: ImportGitHubDialogProps) {
  const close = () => {
    request.cancel();
    onClose();
  };

  const destination = request.destination;

  return (
    <Dialog onOpenChange={(next) => !next && close()} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from GitHub</DialogTitle>
          <DialogDescription>
            Create a new local project from a public repository. The original is never changed.
          </DialogDescription>
        </DialogHeader>
        {/* One group, not two: the group is a proximity row, and a lone field
         * in its own group loses the reveal and reads as static text. */}
        <InputGroup className="w-full" size="compact">
          <InputField
            disabled={request.inputLocked}
            autoComplete="off"
            error={request.urlIssue ?? undefined}
            label="Repository URL"
            onChange={request.setUrl}
            placeholder="https://github.com/owner/repo"
            resting="filled"
            spellCheck={false}
            value={request.url}
          />
          <InputField
            disabled={request.inputLocked}
            autoComplete="off"
            error={request.nameIssue ?? undefined}
            label="Folder name"
            onChange={request.setFolderName}
            placeholder="repo"
            resting="filled"
            spellCheck={false}
            value={request.folderName}
          />
        </InputGroup>
        {/* The destination is a fact, so it is only stated once there is one.
         * Aligned to the field text rather than the dialog edge. */}
        {destination && (
          <p className="m-0 pl-2 text-caption text-muted-foreground">{destination}</p>
        )}
        {request.retainedPath && (
          <p className="m-0 pl-2 text-caption text-muted-foreground">
            Local project: {request.retainedPath}
          </p>
        )}
        {request.failure && <FailureNotice className="m-0 pl-2" failure={request.failure} />}
        <DialogFooter>
          <Button onClick={close} variant="ghost">
            Cancel
          </Button>
          {(request.retainedPath || request.checkingOutcome) && (
            <Button
              disabled={request.pending}
              onClick={request.startAnotherCopy}
              variant="tertiary"
            >
              Start another copy
            </Button>
          )}
          {request.existingPath && (
            <Button disabled={request.pending} onClick={request.openExisting} variant="tertiary">
              Open existing folder
            </Button>
          )}
          <Button disabled={!request.canSubmit} loading={request.pending} onClick={request.submit}>
            {request.retainedPath
              ? 'Open project'
              : request.checkingOutcome
                ? 'Check result'
                : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
