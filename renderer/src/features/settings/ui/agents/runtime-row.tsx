import { Layers, Sparkles, Terminal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { AgentRuntime } from '@/features/settings/domain/agent-catalog';
import {
  describeRuntime,
  type AgentRuntimeAction,
} from '@/features/settings/domain/agent-runtime-status';
import { FailureNotice } from '@/features/settings/ui/failure-notice';
import { SettingsRow } from '@/features/settings/ui/rows';
import type { AgentId } from '@/shared/domain/agent-id';
import type { FailureView } from '@/shared/domain/feature-error';

import { StageTrack } from './stage-track';

const AGENT_ICONS: Record<AgentId, typeof Layers> = {
  claude: Sparkles,
  codex: Terminal,
  stashbase: Layers,
};

export interface RuntimeRowProps {
  runtime: AgentRuntime;
  /** This runtime has a preparation command of its own in flight. */
  busy: boolean;
  /** A failed install, sign-in, or reset stays on the row: a busy spinner that
   *  simply disappeared would contradict the truthful-loading requirement this
   *  panel owns. */
  failure: FailureView | null;
  onAction: (action: AgentRuntimeAction, runtime: AgentRuntime) => void;
  onUninstall: (runtime: AgentRuntime) => void;
}

/** One agent runtime: what it is, where its preparation stands, and the single
 *  action that applies right now. */
export function RuntimeRow({ runtime, busy, failure, onAction, onUninstall }: RuntimeRowProps) {
  const display = describeRuntime(runtime, busy);
  const Icon = AGENT_ICONS[runtime.id];
  const action = display.action;
  const trackStage = display.stage === null || display.stage === 'ready' ? null : display.stage;
  const canUninstall = runtime.installed && runtime.ownership === 'managed' && !busy;
  const hasChildren = trackStage !== null || failure !== null;

  return (
    <SettingsRow
      as="li"
      detail={display.description}
      detailTone={display.failed ? 'error' : 'muted'}
      lead={
        <span className="flex size-8 items-center justify-center rounded-md border border-border text-foreground">
          <Icon aria-hidden="true" className="size-4" />
        </span>
      }
      title={runtime.label}
      trail={
        busy || action || canUninstall ? (
          <>
            {busy && (
              <Button disabled loading size="compact" variant="tertiary">
                Preparing…
              </Button>
            )}
            {!busy && action && (
              <Button onClick={() => onAction(action, runtime)} size="compact" variant="tertiary">
                {action.label}
              </Button>
            )}
            {canUninstall && (
              <Button onClick={() => onUninstall(runtime)} size="compact" variant="ghost">
                Uninstall
              </Button>
            )}
          </>
        ) : null
      }
    >
      {hasChildren && (
        <>
          {trackStage && <StageTrack failed={display.failed} stage={trackStage} />}
          {failure && <FailureNotice className="mt-1" failure={failure} />}
        </>
      )}
    </SettingsRow>
  );
}
