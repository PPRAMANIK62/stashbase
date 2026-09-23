import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AgentPersonaPicker } from '@/features/agent/hooks/use-agent-persona';
import { shapeTokens } from '@/lib/shape-context';
import { FailureNotice } from '@/shared/ui/failure-notice';
import { textFieldClass } from '@/shared/ui/text-field';

/* The field sits one step above the dialog rather than on `background`, which
 * on a light panel reads as a hole punched through it. `resize-none`: the
 * panel owns its own height, and a native grabber in the corner of a modal is
 * the browser's furniture, not the product's.
 *
 * It draws no focus indicator. The field is the dialog's only content and the
 * panel hands it the caret as it opens, so the shared field ring would stand
 * there the whole time the dialog is up — chrome rather than a state — and it
 * would be the one colored thing on a monochrome panel. `focus-visible:ring-0`
 * turns the shared ring off; `outline-none` keeps the base-layer fallback off
 * for the same reason.
 *
 * A persona is prose a writer writes about a voice, so it takes the reading
 * face rather than a mono one. */
const FIELD_CLASS = textFieldClass(
  'h-[min(44vh,22rem)] resize-none overflow-auto bg-surface-3 text-body leading-relaxed text-foreground',
  'focus-visible:ring-0',
  shapeTokens.panel,
);

export interface AgentPersonaDialogProps {
  onClose(): void;
  open: boolean;
  picker: AgentPersonaPicker;
  /** What this scope is called, so the reader can see which one they are
   *  writing for without reading the path. */
  scopeName: string;
}

/**
 * The reader's own persona for one project.
 *
 * It opens on what the reader wrote last, or empty the first time. Save
 * stores it and chooses it, so the dialog is also how a reader returns to
 * Custom after trying a packaged persona; Save is offered whenever that would
 * change something. An empty prompt cannot be chosen: None is how a reader
 * runs without a persona.
 */
export function AgentPersonaDialog({ onClose, open, picker, scopeName }: AgentPersonaDialogProps) {
  // The caller remounts the dialog for each opening, so every opening starts
  // from what is stored and an abandoned draft is not kept.
  const [draft, setDraft] = useState(picker.custom);

  const text = draft.trim();
  const changes = text !== picker.custom || picker.selected !== 'custom';
  const save = async () => {
    if (await picker.saveCustom(draft)) onClose();
  };

  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
      <DialogContent width="wide">
        <DialogHeader>
          <DialogTitle>Custom persona</DialogTitle>
          <DialogDescription className="text-muted-foreground/70">
            How the Agent talks and writes in {scopeName}. Applies from your next message.
          </DialogDescription>
        </DialogHeader>
        <textarea
          aria-label={`Custom persona for ${scopeName}`}
          className={FIELD_CLASS}
          disabled={picker.saving}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Who is the Agent? How does it talk, and how does it write?"
          value={draft}
        />
        {picker.failure && <FailureNotice className="m-0" failure={picker.failure} />}
        <DialogFooter>
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={!text || !changes || picker.saving}
            loading={picker.saving}
            onClick={() => void save()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
