import type { ReactNode } from 'react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { AgentRuntimePort } from '@/features/settings/application/ports';
import { useAgentRuntimes } from '@/features/settings/hooks/use-agent-runtimes';

import { DebugBlock } from './agents/debug-block';

export interface DeveloperToolsProps {
  agentRuntimeApi: AgentRuntimePort;
  onClose(): void;
  open: boolean;
  updatePreview?: ReactNode;
}

export default function DeveloperToolsDialog({
  agentRuntimeApi,
  onClose,
  open,
  updatePreview,
}: DeveloperToolsProps) {
  const runtimes = useAgentRuntimes(agentRuntimeApi);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle>Developer tools</DialogTitle>
        <DebugBlock runtimes={runtimes} />
        {updatePreview}
      </DialogContent>
    </Dialog>
  );
}
