import type { AgentBootstrapStatus } from '../../apiTypes';

export type AgentRuntimeFailureAction = 'copy-install-command' | 'open-mcp-settings';

export interface AgentRuntimeFailurePresentation {
  title: string;
  message: string;
  retryLabel: string;
  manualAction?: AgentRuntimeFailureAction;
  manualLabel?: string;
}

/** Convert the server-owned readiness failure into UI copy and actions.
 * The renderer never infers a recovery from an error string: a manual action
 * exists only when the structured contract explicitly advertises one. */
export function runtimeFailurePresentation(
  status: AgentBootstrapStatus | undefined,
  name: string,
): AgentRuntimeFailurePresentation {
  const failure = status?.failure;
  const message = failure?.message ?? 'The runtime setup did not finish.';
  const manual = failure?.manualRecovery;
  const manualAction = manual === 'install-command'
    ? 'copy-install-command'
    : manual === 'mcp-settings'
      ? 'open-mcp-settings'
      : undefined;
  const manualLabel = manual === 'install-command'
    ? 'Copy install command'
    : manual === 'mcp-settings'
      ? 'View manual setup'
      : undefined;

  switch (failure?.stage) {
    case 'installation':
      return {
        title: `Couldn’t install ${name}`,
        message,
        retryLabel: 'Retry',
        manualAction,
        manualLabel,
      };
    case 'mcp':
      return {
        title: `Couldn’t connect StashBase to ${name}`,
        message,
        retryLabel: 'Retry connection',
        manualAction,
        manualLabel,
      };
    case 'discovery':
      return {
        title: `Couldn’t check ${name}`,
        message,
        retryLabel: 'Retry',
        manualAction,
        manualLabel,
      };
    default:
      return {
        title: `Couldn’t prepare ${name}`,
        message,
        retryLabel: 'Retry',
      };
  }
}
