import { ScrollText } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import type { AgentInstructionsEditor } from '@/features/agent/hooks/use-agent-instructions';
import { NARROW_LABEL, NARROW_TRIGGER } from '@/features/agent/ui/composer/narrow';

import { AgentInstructionsDialog } from './agent-instructions-dialog';

export interface AgentInstructionsControlProps {
  editor: AgentInstructionsEditor;
  scopeName: string;
}

/**
 * The composer's entry to this scope's standing instructions.
 *
 * The dot is the whole presence indicator: it says the reader has replaced the
 * packaged default here, which is the one fact a glance needs. Everything else
 * is behind the dialog, because instructions are read rarely and edited more
 * rarely still.
 */
export function AgentInstructionsControl({ editor, scopeName }: AgentInstructionsControlProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip content="Agent instructions" side="top">
        <Button
          aria-label={
            editor.customized
              ? `Instructions for ${scopeName}, customized`
              : `Instructions for ${scopeName}`
          }
          className={NARROW_TRIGGER}
          leadingIcon={ScrollText}
          onClick={() => setOpen(true)}
          size="compact"
          variant="ghost"
        >
          <span className={NARROW_LABEL}>Instructions</span>
          {editor.customized && (
            <span
              aria-hidden="true"
              className="ml-1 size-1.5 shrink-0 rounded-full bg-foreground/60"
            />
          )}
        </Button>
      </Tooltip>
      <AgentInstructionsDialog
        editor={editor}
        onClose={() => setOpen(false)}
        open={open}
        scopeName={scopeName}
      />
    </>
  );
}
