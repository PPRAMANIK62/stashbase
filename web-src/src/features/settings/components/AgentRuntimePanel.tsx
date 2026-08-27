import { useState } from 'react';
import {
  type Agent,
  type AgentDiscoveryPolicy,
  type AgentSetupFailureSimulation,
  type AgentTurnFailureSimulation,
  type HostedAgentAllowance,
} from '@/common/api/apiTypes';
import { AGENTS } from '@/common/lib/agentCatalog';
import { MoreHorizontalIcon } from '@/common/components/icons';
import { useAgentRuntimes } from '@/features/settings/hooks/useAgentRuntimes';
import { Button } from '@/common/components/ui/button';
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuPortal,
  MenuPositioner,
  MenuTrigger,
} from '@/common/components/ui/menu';
import { Field, FieldLabel } from '@/common/components/ui/field';
import { Select, type SelectOption } from '@/common/components/ui/select';
import { StatusMessage } from '@/common/components/ui/status';
import { SectionDescription, SectionHeading } from '@/common/components/ui/section';
import { Badge } from '@/common/components/ui/badge';
import { AccountSignInForm } from '@/common/components/AccountSignInForm';

/* The dev panel's option tables. Data, not markup: the trigger's label and
 * the popup's rows both come off one array, so they cannot disagree. */
const DEBUG_SELECT_CLASS = 'min-w-44';

const DISCOVERY_POLICIES: readonly SelectOption<AgentDiscoveryPolicy>[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'managed-only', label: 'Managed only' },
  { value: 'system-only', label: 'System only' },
];

const SETUP_FAILURES: readonly SelectOption<AgentSetupFailureSimulation>[] = [
  { value: 'none', label: 'Normal' },
  { value: 'installation', label: 'Fail installation' },
  { value: 'authentication', label: 'Signed-out Codex' },
  { value: 'mcp', label: 'Fail MCP connection' },
];

const TURN_FAILURES: readonly SelectOption<AgentTurnFailureSimulation>[] = [
  { value: 'none', label: 'Normal' },
  { value: 'rate-limit', label: 'Rate limited (429)' },
  { value: 'quota', label: 'Usage limit reached' },
  { value: 'auth-expired', label: 'Auth token expired' },
  { value: 'network', label: 'Network unreachable' },
  { value: 'crash', label: 'Runtime crash' },
];

export function AgentRuntimePanel() {
  const {
    agents,
    debug,
    busy,
    status,
    allowance,
    allowanceUnavailable,
    refreshAllowance,
    install,
    login,
    uninstall,
    updateDebug,
    resetFirstRun,
  } = useAgentRuntimes();
  const [accountSignInOpen, setAccountSignInOpen] = useState(false);

  return (
    <div>
      <SectionHeading level={3} className="mb-1">Agent runtimes</SectionHeading>
      <SectionDescription className="mb-2.5">
        Default is included and uses your fixed 7-day account allowance. Codex and Claude Code remain available as bring-your-own runtimes.
      </SectionDescription>
      {accountSignInOpen && (
        <div className="mb-2.5 rounded-lg border border-border bg-card p-3">
          <AccountSignInForm
            onBack={() => setAccountSignInOpen(false)}
            onSignedIn={() => {
              setAccountSignInOpen(false);
              refreshAllowance();
            }}
          />
        </div>
      )}
      {allowance && <AgentAllowanceCard allowance={allowance} onRefresh={refreshAllowance} />}
      {!allowance && allowanceUnavailable && agents.some((agent) => agent.id === 'stashbase' && agent.state === 'available') && (
        <div className="mb-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-muted-foreground">
          Agent usage is temporarily unavailable. <Button variant="ghost" size="sm" onClick={refreshAllowance}>Retry</Button>
        </div>
      )}
      <ul className="m-0 list-none overflow-hidden rounded-lg border border-border bg-background p-0">
        {AGENTS.map((definition) => {
          const runtime = agents.find((candidate) => candidate.id === definition.id);
          const phase = runtime?.bootstrap?.phase;
          const working = phase === 'installing' || phase === 'authenticating' || phase === 'configuring';
          const description = runtimeDescription(runtime);
          const action = runtimeAction(runtime, working);
          const Icon = definition.Icon;
          return (
            <li key={definition.id} className="flex items-center gap-3 border-t border-border px-3 py-2.5 first:border-t-0">
              <span className="inline-grid size-7 flex-none place-items-center rounded-md border border-border bg-pane [&_svg]:size-4"><Icon /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold text-foreground">{definition.launcherLabel}</span>
                <span className="block truncate text-xs text-muted-foreground">{description}</span>
              </span>
              {action && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy != null || working}
                  onClick={() => {
                    if (action.kind === 'account') setAccountSignInOpen(true);
                    else void (action.kind === 'login' ? login(definition.id) : install(definition.id));
                  }}
                >
                  {action.label}
                </Button>
              )}
              {/* Uninstall applies only to the StashBase-managed install —
                * a system runtime is the user's own and is never removed. */}
              {runtime?.installed && runtime.source === 'managed' && !working && (
                <Menu>
                  <MenuTrigger
                    className="inline-grid size-7 flex-none cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted data-[popup-open]:text-foreground"
                    disabled={busy != null}
                    aria-label={`More actions for ${definition.launcherLabel}`}
                    title="More actions"
                  >
                    <MoreHorizontalIcon className="size-4" />
                  </MenuTrigger>
                  <MenuPortal>
                    <MenuPositioner side="bottom" align="end" sideOffset={4} collisionPadding={8}>
                      <MenuPopup aria-label={`${definition.launcherLabel} actions`}>
                        <MenuItem
                          className="text-danger data-highlighted:bg-destructive/10"
                          onClick={() => void uninstall(definition.id)}
                        >
                          Uninstall runtime…
                        </MenuItem>
                      </MenuPopup>
                    </MenuPositioner>
                  </MenuPortal>
                </Menu>
              )}
            </li>
          );
        })}
      </ul>

      {debug.enabled && (
        <section className="mt-5 rounded-lg border border-status-warning/30 bg-status-warning/10 p-3">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <SectionHeading level={4}>Agent bootstrap testing</SectionHeading>
            <Badge tone="warning">Development only</Badge>
          </div>
          <p className="mt-0 mb-3 text-sm leading-normal text-muted-foreground">
            These development-only controls change discovery inside StashBase. They never uninstall a global Agent or clear provider credentials.
          </p>
          {/* Explicit `htmlFor`, not a wrapping label: `AgentDebugSelect`
            * nests its `select` inside a caret wrapper, so the implicit
            * association depended on that markup staying a subtree. */}
          <Field className="flex-row items-center justify-between gap-3">
            <FieldLabel htmlFor="agent-debug-discovery-policy" className="text-sm font-normal">Discovery source</FieldLabel>
            <Select
              id="agent-debug-discovery-policy"
              className={DEBUG_SELECT_CLASS}
              items={DISCOVERY_POLICIES}
              value={debug.discoveryPolicy}
              disabled={busy != null}
              onValueChange={(discoveryPolicy) => void updateDebug({ discoveryPolicy })}
            />
          </Field>
          <Field className="mt-3 flex-row items-center justify-between gap-3">
            <FieldLabel htmlFor="agent-debug-next-failure" className="text-sm font-normal">Next setup result</FieldLabel>
            <Select
              id="agent-debug-next-failure"
              className={DEBUG_SELECT_CLASS}
              items={SETUP_FAILURES}
              value={debug.nextFailure}
              disabled={busy != null}
              onValueChange={(nextFailure) => void updateDebug({ nextFailure })}
            />
          </Field>
          <p className="mt-2 mb-0 text-xs leading-normal text-muted-foreground">
            The failure is injected once, then resets to Normal. Installation failure applies only when setup reaches an install; reset first run to test it with an existing runtime. Signed-out applies when Codex setup reaches its sign-in check; Claude has no setup sign-in gate — test its signed-out state with Auth token expired below, in a Claude chat.
          </p>
          <Field className="mt-3 flex-row items-center justify-between gap-3">
            <FieldLabel htmlFor="agent-debug-next-turn-failure" className="text-sm font-normal">Next turn result</FieldLabel>
            <Select
              id="agent-debug-next-turn-failure"
              className={DEBUG_SELECT_CLASS}
              items={TURN_FAILURES}
              value={debug.nextTurnFailure}
              disabled={busy != null}
              onValueChange={(nextTurnFailure) => void updateDebug({ nextTurnFailure })}
            />
          </Field>
          <p className="mt-2 mb-0 text-xs leading-normal text-muted-foreground">
            Applies to the next prompt sent in any open chat, once. The prompt never reaches the native runtime; Runtime crash ends that session like a real process exit.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={busy != null} onClick={() => void resetFirstRun('codex')}>
              Reset Codex first run
            </Button>
            <Button variant="outline" size="sm" disabled={busy != null} onClick={() => void resetFirstRun('claude')}>
              Reset Claude first run
            </Button>
          </div>
        </section>
      )}

      {status && (
        <StatusMessage tone={status.tone} className="mt-3 wrap-anywhere">{status.text}</StatusMessage>
      )}
    </div>
  );
}

function AgentAllowanceCard({ allowance, onRefresh }: { allowance: HostedAgentAllowance; onRefresh: () => void }) {
  const percent = Math.max(0, Math.min(100, allowance.remainingPercent));
  const reset = allowance.windowEndsAt ? new Date(allowance.windowEndsAt).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  }) : null;
  return (
    <div className="mb-2.5 rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">7-day Agent allowance</div>
          <div className="text-xs text-muted-foreground">{percent}% remaining{reset ? ` · Resets ${reset}` : ' · Starts on first use'}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh}>Refresh</Button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
      <details className="mt-1.5 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Token detail</summary>
        <div className="mt-1">
          {allowance.inputTokens.toLocaleString()} input · {allowance.outputTokens.toLocaleString()} output · {allowance.cacheReadTokens.toLocaleString()} cached
        </div>
      </details>
    </div>
  );
}

/** MCP setup is automatic (startup auto-connect, repeated before native
 * attach), so the healthy states carry no button at all. An affordance
 * appears only when the user must act: nothing is installed or a bootstrap
 * explicitly failed. */
function runtimeAction(runtime: Agent | undefined, working: boolean): { label: string; kind: 'prepare' | 'login' | 'account' } | null {
  if (working) return { label: 'Preparing…', kind: 'prepare' };
  if (!runtime) return null;
  if (runtime.bootstrap?.phase === 'failed') {
    if (runtime.bootstrap.failure?.code === 'account-required') return { label: 'Sign in', kind: 'account' };
    if (runtime.bootstrap.failure?.stage === 'authentication') return { label: 'Sign in', kind: 'login' };
    return { label: runtime.bootstrap.failure?.stage === 'mcp' ? 'Retry connection' : 'Retry', kind: 'prepare' };
  }
  if (!runtime.installed) return { label: 'Install', kind: 'prepare' };
  return null;
}

function runtimeDescription(runtime: Agent | undefined): string {
  if (!runtime) return 'Checking…';
  const bootstrap = runtime.bootstrap;
  if (bootstrap?.phase === 'failed') return bootstrap.failure?.message ?? 'Setup failed';
  if (bootstrap?.phase === 'installing' || bootstrap?.phase === 'authenticating' || bootstrap?.phase === 'configuring') return bootstrap.message ?? 'Preparing…';
  if (!runtime.installed) return 'Not installed';
  const source = runtime.source === 'bundled'
    ? 'Included with StashBase'
    : runtime.source === 'managed' ? 'StashBase-managed runtime' : 'System runtime';
  return bootstrap?.phase === 'ready' ? `Ready for Chat · ${source}` : source;
}
