import { useId } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AgentInstructionsEditor } from '@/features/agent/hooks/use-agent-instructions';
import { focusRing } from '@/lib/focus-ring';

/* The field sits one step above the dialog rather than on `background`, which
 * on a light panel reads as a hole punched through it. No `resize`: the panel
 * owns its own height, and a native grabber in the corner of a modal is the
 * browser's furniture, not the product's. */
const FIELD_CLASS = focusRing(
  'block h-[min(52vh,26rem)] w-full overflow-auto rounded-md border border-border bg-surface-3 px-3 py-2.5 font-mono text-caption leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50',
);

export interface AgentInstructionsDialogProps {
  editor: AgentInstructionsEditor;
  onClose(): void;
  open: boolean;
  /** What this scope is called, so the reader can see which one they are
   *  editing without reading the path. */
  scopeName: string;
}

/**
 * The standing instructions every Chat in one scope runs under.
 *
 * Monospace because this is a prompt the runtime carries verbatim, where a
 * line break is content rather than styling. Clearing the field restores the
 * packaged default, which is the only way back once a scope is customized, so
 * the control says that rather than hiding it behind an empty box.
 */
export function AgentInstructionsDialog({
  editor,
  onClose,
  open,
  scopeName,
}: AgentInstructionsDialogProps) {
  const fieldId = useId();

  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
      <DialogContent width="wide">
        <DialogHeader>
          <DialogTitle>Instructions for {scopeName}</DialogTitle>
          <DialogDescription>
            Every Chat in this scope starts with these. Open Chats pick them up on their next
            conversation.
          </DialogDescription>
        </DialogHeader>
        <label className="sr-only" htmlFor={fieldId}>
          Agent Instructions for {scopeName}
        </label>
        <textarea
          className={FIELD_CLASS}
          disabled={editor.loading || editor.saving}
          id={fieldId}
          onChange={(event) => editor.setDraft(event.target.value)}
          spellCheck={false}
          value={editor.draft}
        />
        {editor.failure && (
          <p className="m-0 text-caption text-destructive" role="alert">
            {editor.failure.message}
          </p>
        )}
        <DialogFooter>
          {editor.customized && (
            <Button
              className="mr-auto"
              disabled={editor.saving}
              onClick={editor.reset}
              variant="ghost"
            >
              Restore default
            </Button>
          )}
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
          <Button disabled={!editor.dirty || editor.saving} loading={editor.saving} onClick={editor.save}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
