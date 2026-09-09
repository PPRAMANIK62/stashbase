import { Collapsible } from '@base-ui/react/collapsible';
import { Layers, RefreshCw, Sparkles, Terminal } from 'lucide-react';
import { useId, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import {
  describeRuntime,
  type AgentRuntimeAction,
} from '@/features/settings/domain/agent-runtime-status';
import type { useAgentRuntimes } from '@/features/settings/hooks/use-agent-runtimes';
import {
  Disclosure,
  ProgressBar,
  SettingsGroup,
  SettingsList,
  SettingsPane,
  SettingsRow,
} from '@/features/settings/ui/rows';
import { useIcon } from '@/lib/icon-context';
import type { HostedAgentAllowance } from '@/shared/account';
import type { AgentId } from '@/shared/agent-protocol';
import type { Agent, AgentDiscoveryPolicy } from '@/shared/agent-runtime';

import { StageTrack } from './stage-track';

type Runtimes = ReturnType<typeof useAgentRuntimes>;

export interface AgentRuntimesPanelProps {
  runtimes: Runtimes;
}

function isBusy(runtimes: Runtimes, id: AgentId): boolean {
  return (
    (runtimes.install.isPending && runtimes.install.variables === id) ||
    (runtimes.login.isPending && runtimes.login.variables === id) ||
    (runtimes.uninstall.isPending && runtimes.uninstall.variables === id) ||
    (runtimes.resetFirstRun.isPending && runtimes.resetFirstRun.variables === id)
  );
}

/** A failed install/login/reset must stay visible on its own row — a busy
 *  spinner that just disappears on failure would contradict the "truthful
 *  capability-local loading and availability" requirement this panel owns. */
function actionFailure(runtimes: Runtimes, id: AgentId): string | null {
  if (runtimes.install.isError && runtimes.install.variables === id) {
    return runtimes.install.error?.message ?? 'Setup failed.';
  }
  if (runtimes.login.isError && runtimes.login.variables === id) {
    return runtimes.login.error?.message ?? 'Sign-in failed.';
  }
  if (runtimes.resetFirstRun.isError && runtimes.resetFirstRun.variables === id) {
    return runtimes.resetFirstRun.error?.message ?? 'Reset failed.';
  }
  return null;
}

const AGENT_ICONS: Record<AgentId, typeof Layers> = {
  claude: Sparkles,
  codex: Terminal,
  stashbase: Layers,
};

const DISCOVERY_POLICIES: ReadonlyArray<{ value: AgentDiscoveryPolicy; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'managed-only', label: 'Managed only' },
  { value: 'system-only', label: 'System only' },
];

const SETUP_FAILURES = [
  { value: 'none', label: 'Normal' },
  { value: 'installation', label: 'Fail installation' },
  { value: 'authentication', label: 'Signed-out Codex' },
  { value: 'mcp', label: 'Fail MCP connection' },
] as const;

const TURN_FAILURES = [
  { value: 'none', label: 'Normal' },
  { value: 'rate-limit', label: 'Rate limited (429)' },
  { value: 'quota', label: 'Usage limit reached' },
  { value: 'auth-expired', label: 'Auth token expired' },
  { value: 'network', label: 'Network unreachable' },
  { value: 'crash', label: 'Runtime crash' },
] as const;

function AllowanceRow({
  allowance,
  onRefresh,
}: {
  allowance: HostedAgentAllowance;
  onRefresh: () => void;
}) {
  const ChevronDown = useIcon('chevron-down');
  const ChevronRight = useIcon('chevron-right');
  const [detailOpen, setDetailOpen] = useState(false);
  const detailPanelId = useId();
  const percent = Math.max(0, Math.min(100, Math.round(allowance.remainingPercent)));
  const reset = allowance.windowEndsAt
    ? new Date(allowance.windowEndsAt).toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <SettingsRow
      detail={`${percent}% remaining${reset ? ` · Resets ${reset}` : ' · Starts on first use'}`}
      title="7-day Agent allowance"
      trail={
        <Button leadingIcon={RefreshCw} onClick={onRefresh} size="compact" variant="ghost">
          Refresh
        </Button>
      }
    >
      <ProgressBar value={percent} />
      <Collapsible.Root className="mt-1" onOpenChange={setDetailOpen} open={detailOpen}>
        <Collapsible.Trigger
          render={
            <Button
              aria-controls={detailPanelId}
              className="-ml-1.5 h-auto gap-1.5 px-1.5 py-0.5 text-caption font-normal whitespace-nowrap"
              size="compact"
              trailingIcon={detailOpen ? ChevronDown : ChevronRight}
              variant="ghost"
            >
              Token detail
            </Button>
          }
        />
        <Collapsible.Panel className="pt-0.5 text-caption text-muted-foreground" id={detailPanelId}>
          {allowance.inputTokens.toLocaleString()} input · {allowance.outputTokens.toLocaleString()}{' '}
          output · {allowance.cacheReadTokens.toLocaleString()} cached
        </Collapsible.Panel>
      </Collapsible.Root>
    </SettingsRow>
  );
}

function RuntimeRow({
  agent,
  busy,
  failure,
  onAction,
  onUninstall,
}: {
  agent: Agent;
  busy: boolean;
  failure: string | null;
  onAction: (action: AgentRuntimeAction, agent: Agent) => void;
  onUninstall: (agent: Agent) => void;
}) {
  const display = describeRuntime(agent, busy);
  const Icon = AGENT_ICONS[agent.id];
  const showTrack = display.stage !== null && display.stage !== 'ready';
  const canUninstall = agent.installed && agent.source === 'managed' && !busy;
  const hasChildren = showTrack || failure !== null;

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
      title={agent.label}
      trail={
        busy || display.action || canUninstall ? (
          <>
            {busy && (
              <Button disabled loading size="compact" variant="tertiary">
                Preparing…
              </Button>
            )}
            {!busy && display.action && (
              <Button
                onClick={() => onAction(display.action!, agent)}
                size="compact"
                variant="tertiary"
              >
                {display.action.label}
              </Button>
            )}
            {canUninstall && (
              <Button onClick={() => onUninstall(agent)} size="compact" variant="ghost">
                Uninstall
              </Button>
            )}
          </>
        ) : null
      }
    >
      {hasChildren && (
        <>
          {showTrack && (
            <StageTrack
              failed={display.failed}
              stage={display.stage!}
              stageIndex={display.stageIndex}
            />
          )}
          {failure && (
            <p className="mt-1 text-caption text-destructive" role="alert">
              {failure}
            </p>
          )}
        </>
      )}
    </SettingsRow>
  );
}

function UninstallAgentDialog({
  agent,
  failure,
  pending,
  onCancel,
  onConfirm,
}: {
  agent: Agent | null;
  failure: string | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const label = agent?.label ?? '';
  return (
    <Dialog open={agent !== null} onOpenChange={(open) => !open && !pending && onCancel()}>
      <DialogContent closeDisabled={pending}>
        <DialogHeader>
          <DialogTitle>Uninstall {label} runtime?</DialogTitle>
          <DialogDescription>
            Uninstall the StashBase-managed {label} runtime to free disk space? Any active {label}{' '}
            chat ends now. Your provider login and history are not affected; the next New Chat
            prepares the runtime again.
          </DialogDescription>
        </DialogHeader>
        {failure && (
          <p className="mt-1 text-caption text-destructive" role="alert">
            {failure}
          </p>
        )}
        <DialogFooter>
          <Button disabled={pending} onClick={onCancel} variant="tertiary">
            Cancel
          </Button>
          <Button loading={pending} onClick={onConfirm} variant="primary">
            Uninstall
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DebugSelectRow<Value extends string>({
  disabled,
  items,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  items: ReadonlyArray<{ value: Value; label: string }>;
  label: string;
  onChange: (value: Value) => void;
  value: Value;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <label className="text-caption text-foreground" htmlFor={id}>
        {label}
      </label>
      <Select disabled={disabled} onValueChange={(next) => onChange(next as Value)} value={value}>
        <SelectTrigger className="min-w-40" id={id} size="compact" />
        <SelectContent>
          {items.map((item, index) => (
            <SelectItem index={index} key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Development-only preparation controls. `debug.enabled` is a server-truthful
 *  flag on the wire response (see `AgentRuntimeDebugState`) — the renderer has
 *  no environment-variable authority of its own to decide this. */
function DebugBlock({ runtimes }: { runtimes: Runtimes }) {
  const debug = runtimes.catalog.data?.debug;
  if (!debug?.enabled) return null;
  const busy = runtimes.updateDebug.isPending || runtimes.resetFirstRun.isPending;

  return (
    <Disclosure
      badge={
        <Badge color="amber" size="compact">
          Development only
        </Badge>
      }
      summary="Agent bootstrap testing"
    >
      <p className="text-caption text-muted-foreground">
        These controls change discovery inside StashBase only — they never uninstall a global Agent
        or clear provider credentials.
      </p>
      <DebugSelectRow
        disabled={busy}
        items={DISCOVERY_POLICIES}
        label="Discovery source"
        onChange={(discoveryPolicy) => runtimes.updateDebug.mutate({ discoveryPolicy })}
        value={debug.discoveryPolicy}
      />
      <DebugSelectRow
        disabled={busy}
        items={SETUP_FAILURES}
        label="Next setup result"
        onChange={(nextFailure) => runtimes.updateDebug.mutate({ nextFailure })}
        value={debug.nextFailure}
      />
      <DebugSelectRow
        disabled={busy}
        items={TURN_FAILURES}
        label="Next turn result"
        onChange={(nextTurnFailure) => runtimes.updateDebug.mutate({ nextTurnFailure })}
        value={debug.nextTurnFailure}
      />
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() => runtimes.resetFirstRun.mutate('codex')}
          size="compact"
          variant="tertiary"
        >
          Reset Codex first run
        </Button>
        <Button
          disabled={busy}
          onClick={() => runtimes.resetFirstRun.mutate('claude')}
          size="compact"
          variant="tertiary"
        >
          Reset Claude first run
        </Button>
      </div>
      {(runtimes.updateDebug.error ?? runtimes.resetFirstRun.error) && (
        <p className="mt-2.5 text-caption text-destructive" role="alert">
          {(runtimes.updateDebug.error ?? runtimes.resetFirstRun.error)?.message ??
            'Update failed.'}
        </p>
      )}
    </Disclosure>
  );
}

export function AgentRuntimesPanel({ runtimes }: AgentRuntimesPanelProps) {
  const [uninstallTarget, setUninstallTarget] = useState<Agent | null>(null);

  const onAction = (action: AgentRuntimeAction, agent: Agent) => {
    if (action.kind === 'login') runtimes.login.mutate(agent.id);
    else if (action.kind === 'install' || action.kind === 'retry')
      runtimes.install.mutate(agent.id);
    // 'account' has no in-app sign-in surface yet in this renderer; nothing
    // to dispatch to until that Settings-owned account flow exists.
  };

  const confirmUninstall = () => {
    const id = uninstallTarget?.id;
    if (!id || id === 'stashbase') return;
    runtimes.uninstall.mutate(id, { onSuccess: () => setUninstallTarget(null) });
  };

  const showAllowance =
    (runtimes.allowance.isSuccess && runtimes.allowance.data) || runtimes.allowance.isError;

  return (
    <SettingsPane
      lede="Built-in includes free credits through your fixed 7-day account allowance. Codex and Claude Code remain available as bring-your-own runtimes."
      title="Agents"
    >
      {showAllowance && (
        <SettingsGroup title="Allowance">
          <SettingsList>
            {runtimes.allowance.isSuccess && runtimes.allowance.data ? (
              <AllowanceRow
                allowance={runtimes.allowance.data}
                onRefresh={() => runtimes.allowance.refetch()}
              />
            ) : (
              <SettingsRow
                title={
                  <span className="font-normal text-muted-foreground">
                    Agent usage is temporarily unavailable.
                  </span>
                }
                trail={
                  <Button
                    onClick={() => runtimes.allowance.refetch()}
                    size="compact"
                    variant="ghost"
                  >
                    Retry
                  </Button>
                }
              />
            )}
          </SettingsList>
        </SettingsGroup>
      )}

      <SettingsGroup title="Runtimes">
        <SettingsList as="ul">
          {runtimes.catalog.isLoading && (
            <li className="px-3.5 py-2.5 text-caption text-muted-foreground">
              Checking agent runtimes…
            </li>
          )}
          {runtimes.catalog.isError && (
            <li className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-caption text-muted-foreground">
              <span>Agent runtimes are unavailable.</span>
              <Button onClick={() => runtimes.catalog.refetch()} size="compact" variant="ghost">
                Retry
              </Button>
            </li>
          )}
          {(runtimes.catalog.data?.clis ?? []).map((agent) => (
            <RuntimeRow
              agent={agent}
              busy={isBusy(runtimes, agent.id)}
              failure={actionFailure(runtimes, agent.id)}
              key={agent.id}
              onAction={onAction}
              onUninstall={setUninstallTarget}
            />
          ))}
        </SettingsList>
      </SettingsGroup>

      <DebugBlock runtimes={runtimes} />

      <UninstallAgentDialog
        agent={uninstallTarget}
        failure={
          runtimes.uninstall.isError && runtimes.uninstall.variables === uninstallTarget?.id
            ? (runtimes.uninstall.error?.message ?? 'Uninstall failed.')
            : null
        }
        onCancel={() => setUninstallTarget(null)}
        onConfirm={confirmUninstall}
        pending={runtimes.uninstall.isPending}
      />
    </SettingsPane>
  );
}
