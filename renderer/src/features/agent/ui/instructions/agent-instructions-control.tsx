import { ScrollText } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { AgentInstructionsEditor } from '@/features/agent/hooks/use-agent-instructions';

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
      <Button
        aria-label={
          editor.customized
            ? `Instructions for ${scopeName}, customized`
            : `Instructions for ${scopeName}`
        }
        leadingIcon={ScrollText}
        onClick={() => setOpen(true)}
        size="compact"
        title="Standing instructions for every Chat in this scope"
        variant="ghost"
      >
        Instructions
        {editor.customized && (
          <span
            aria-hidden="true"
            className="ml-1 size-1.5 shrink-0 rounded-full bg-foreground/60"
          />
        )}
      </Button>
      <AgentInstructionsDialog
        editor={editor}
        onClose={() => setOpen(false)}
        open={open}
        scopeName={scopeName}
      />
    </>
  );
}
