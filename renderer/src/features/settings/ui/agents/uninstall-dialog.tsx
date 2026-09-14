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
          Remove the copy of {label} managed by StashBase and end its active chats. Your provider
          sign-in and chat history are kept. Set up {label} again to start a new chat.
        </>
      }
      failure={failure}
      onCancel={onCancel}
      onConfirm={onConfirm}
      open={runtime !== null}
      pending={pending}
      title={`Uninstall ${label}?`}
    />
  );
}
