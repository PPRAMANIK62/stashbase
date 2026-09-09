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
import type { AgentHistoryEntry } from '@/features/agent/domain/conversation-history';
import type { AgentHistoryMutation } from '@/features/agent/hooks/use-conversation-history';

export function DeleteConversationDialog({
  entry,
  failure,
  onClose,
  onDelete,
  pending,
  workspaceName,
}: {
  entry: AgentHistoryEntry | null;
  failure: string | null;
  onClose(): void;
  onDelete(entry: AgentHistoryEntry): Promise<AgentHistoryMutation>;
  pending: boolean;
  workspaceName: string;
}) {
  // Only a removal that went through closes the dialog; a refusal leaves it
  // open so the reason stays in front of the person who asked for it.
  const remove = async () => {
    if (!entry) return;
    if ((await onDelete(entry)).kind === 'done') onClose();
  };

  return (
    <Dialog onOpenChange={(open) => !open && !pending && onClose()} open={entry !== null}>
      <DialogContent closeDisabled={pending}>
        <DialogHeader>
          <DialogTitle>Delete conversation?</DialogTitle>
          <DialogDescription>
            “{entry?.title}” will be removed from {workspaceName}. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {failure && (
          <p className="mt-2 text-caption text-destructive" role="alert">
            {failure}
          </p>
        )}
        <DialogFooter className="mt-5">
          <Button disabled={pending} onClick={onClose} variant="tertiary">
            Cancel
          </Button>
          <Button
            className="text-destructive hover:text-destructive"
            disabled={pending}
            leadingIcon={Trash2}
            loading={pending}
            onClick={() => void remove()}
            variant="secondary"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
