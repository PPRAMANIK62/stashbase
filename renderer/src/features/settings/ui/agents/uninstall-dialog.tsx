import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { AgentRuntime } from '@/features/settings/domain/agent-catalog';

export interface UninstallAgentDialogProps {
  /** The runtime under confirmation, or `null` while the dialog is closed. */
  runtime: AgentRuntime | null;
  failure: string | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Removing a managed runtime frees disk but ends any live chat with it, so
 *  the consequence is spelled out before the button. */
export function UninstallAgentDialog({
  runtime,
  failure,
  pending,
  onCancel,
  onConfirm,
}: UninstallAgentDialogProps) {
  const label = runtime?.label ?? '';
  return (
    <ConfirmDialog
      confirmLabel="Uninstall"
      description={
        <>
          Uninstall the StashBase-managed {label} runtime to free disk space? Any active {label}{' '}
          chat ends now. Your provider login and history are not affected; the next New Chat
          prepares the runtime again.
        </>
      }
      failure={failure}
      onCancel={onCancel}
      onConfirm={onConfirm}
      open={runtime !== null}
      pending={pending}
      title={`Uninstall ${label} runtime?`}
    />
  );
}
