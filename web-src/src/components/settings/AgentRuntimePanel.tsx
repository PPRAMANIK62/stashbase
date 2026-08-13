import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Agent, type AgentDiscoveryPolicy, type AgentRuntimeDebugState, type AgentsResponse } from '../../api';
import { AGENT_META, AGENTS, type AgentKind } from '../../agentCatalog';
import { Button } from '../ui/button';
import { StatusMessage } from '../ui/status';

const DEFAULT_DEBUG: AgentRuntimeDebugState = {
  enabled: false,
  discoveryPolicy: 'auto',
  simulateInstallFailure: false,
  simulateMcpFailure: false,
};

export function AgentRuntimePanel() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [debug, setDebug] = useState<AgentRuntimeDebugState>(DEFAULT_DEBUG);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const activeInstall = useMemo(
    () => agents.some((agent) => agent.bootstrap?.phase === 'installing' || agent.bootstrap?.phase === 'configuring'),
    [agents],
  );

  const applyResponse = useCallback((response: AgentsResponse) => {
    setAgents(response.clis);
    setDebug(response.debug ?? DEFAULT_DEBUG);
  }, []);

  const refresh = useCallback(async (silent = false) => {
    try {
      applyResponse(await api.listAgents());
    } catch (error) {
      if (!silent) setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    }
  }, [applyResponse]);

  useEffect(() => { void refresh(true); }, [refresh]);
  useEffect(() => {
    if (!activeInstall) return;
    const timer = window.setInterval(() => { void refresh(true); }, 500);
    return () => window.clearInterval(timer);
  }, [activeInstall, refresh]);

  async function install(agent: AgentKind) {
    setBusy(`install:${agent}`);
    setStatus(null);
    try {
      applyResponse(await api.bootstrapAgent(agent));
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
    }
  }

  async function updateDebug(patch: Partial<Omit<AgentRuntimeDebugState, 'enabled'>>) {
    setBusy('debug');
    setStatus(null);
    try {
      applyResponse(await api.setAgentRuntimeDebug(patch));
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
    }
  }

  async function resetFirstRun(agent: AgentKind) {
    const label = AGENT_META[agent].name;
    if (!window.confirm(`Reset the StashBase-managed ${label} runtime? Your global installation and provider login are not changed.`)) return;
    setBusy(`reset:${agent}`);
    setStatus(null);
    try {
      applyResponse(await api.setAgentRuntimeDebug({ discoveryPolicy: 'managed-only' }));
      applyResponse(await api.resetManagedAgent(agent));
      setStatus({ tone: 'success', text: `${label} now simulates a first-time user. Click New Chat to test installation, then return discovery to Auto when finished.` });
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-1 text-base font-semibold">Agent runtimes</div>
      <div className="mb-2.5 text-sm leading-normal text-muted-foreground">
        StashBase uses an existing system Agent when available, or installs an official runtime privately on first New Chat.
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        {AGENTS.map((definition) => {
          const runtime = agents.find((candidate) => candidate.id === definition.id);
          const phase = runtime?.bootstrap?.phase;
          const working = phase === 'installing' || phase === 'configuring';
          const description = runtimeDescription(runtime);
          const Icon = definition.Icon;
          return (
            <div key={definition.id} className="flex items-center gap-3 border-t border-border px-3 py-2.5 first:border-t-0">
              <span className="inline-grid size-7 flex-none place-items-center rounded-md border border-border bg-pane [&_svg]:size-4"><Icon /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold text-foreground">{definition.launcherLabel}</span>
                <span className="block truncate text-xs text-muted-foreground">{description}</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={busy != null || working}
                onClick={() => void install(definition.id)}
              >
                {working ? 'Preparing…' : runtime?.installed ? 'Connect MCP' : 'Install'}
              </Button>
            </div>
          );
        })}
      </div>

      {debug.enabled && (
        <section className="mt-5 border-t border-border pt-4.5">
          <div className="mb-1 text-base font-semibold">Agent bootstrap testing</div>
          <p className="mt-0 mb-3 text-sm leading-normal text-muted-foreground">
            These development-only controls change discovery inside StashBase. They never uninstall a global Agent or clear provider credentials.
          </p>
          <label className="flex items-center justify-between gap-3 text-sm text-foreground">
            <span>Discovery source</span>
            <select
              className="h-8 min-w-44 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              value={debug.discoveryPolicy}
              disabled={busy != null}
              onChange={(event) => void updateDebug({ discoveryPolicy: event.target.value as AgentDiscoveryPolicy })}
            >
              <option value="auto">Auto</option>
              <option value="managed-only">Managed only</option>
              <option value="system-only">System only</option>
            </select>
          </label>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="accent-accent"
              checked={debug.simulateInstallFailure}
              disabled={busy != null}
              onChange={(event) => void updateDebug({ simulateInstallFailure: event.target.checked })}
            />
            Simulate installation failure
          </label>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="accent-accent"
              checked={debug.simulateMcpFailure}
              disabled={busy != null}
              onChange={(event) => void updateDebug({ simulateMcpFailure: event.target.checked })}
            />
            Simulate MCP connection failure
          </label>
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

function runtimeDescription(runtime: Agent | undefined): string {
  if (!runtime) return 'Checking…';
  const bootstrap = runtime.bootstrap;
  if (bootstrap?.phase === 'failed') return bootstrap.error ?? 'Setup failed';
  if (bootstrap?.phase === 'installing' || bootstrap?.phase === 'configuring') return bootstrap.message ?? 'Preparing…';
  if (!runtime.installed) return 'Not installed';
  return runtime.source === 'managed' ? 'StashBase-managed runtime' : 'System runtime';
}
