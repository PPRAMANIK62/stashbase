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
import { shapeTokens } from '@/lib/shape-context';
import { FailureNotice } from '@/shared/ui/failure-notice';
import { textFieldClass } from '@/shared/ui/text-field';

/* The field sits one step above the dialog rather than on `background`, which
 * on a light panel reads as a hole punched through it. `resize-none`: the
 * panel owns its own height, and a native grabber in the corner of a modal is
 * the browser's furniture, not the product's.
 *
 * It draws no focus indicator. The field is the dialog's only content and the
 * panel hands it the caret as it opens, so a ring would stand there the whole
 * time the dialog is up — chrome rather than a state — and it would be the one
 * colored thing on a monochrome panel. The caret already says where the typing
 * lands. `outline-none` keeps the base-layer fallback ring off for the same
 * reason. */
// The editor sits on the dialog's own raised surface and holds a file's text,
// so it takes the panel corner, a mono face, and a fixed height it does not
// let the reader drag.
const FIELD_CLASS = textFieldClass(
  'h-[min(52vh,26rem)] resize-none overflow-auto bg-surface-3 font-mono text-caption leading-relaxed text-foreground',
  shapeTokens.panel,
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
            Customize how the Agent responds and works with your files.
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
        {editor.failure && <FailureNotice className="m-0" failure={editor.failure} />}
        <DialogFooter>
          {editor.customized && (
            <Button
              /* The retreat keeps its box on the content edge, where the
               * field's frame and the title start, so the pill that appears
               * under the pointer lines up with the field above it. Its
               * padding is tightened to the same 6px the Chat header's rename
               * button uses, so the label at rest sits on that column too
               * instead of reading as indented by a full ladder step. */
              className="mr-auto px-1.5"
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
          <Button
            disabled={!editor.dirty || editor.saving}
            loading={editor.saving}
            onClick={editor.save}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
