import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { AgentRuntimePort } from '@/features/settings/application/ports';
import { useAccountView } from '@/features/settings/hooks/account-context';
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
  const account = useAccountView();
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
        {/* The sign-in banner appears once per installation; this brings it
         *  back so a first launch can be checked again. */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-caption text-muted-foreground">First-launch sign-in banner</p>
          <Button onClick={account.resetOffers} size="compact" variant="tertiary">
            Show again
          </Button>
        </div>
        {updatePreview}
      </DialogContent>
    </Dialog>
  );
}
