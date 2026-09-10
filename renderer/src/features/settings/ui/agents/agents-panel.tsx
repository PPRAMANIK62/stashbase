import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { AgentRuntimePort } from '@/features/settings/application/ports';
import type { AgentRuntime } from '@/features/settings/domain/agent-catalog';
import type { AgentRuntimeAction } from '@/features/settings/domain/agent-runtime-status';
import { useAgentRuntimes } from '@/features/settings/hooks/use-agent-runtimes';
import {
  SettingsGroup,
  SettingsList,
  SettingsPane,
  SettingsRow,
} from '@/features/settings/ui/rows';

import { AllowanceRow } from './allowance-row';
import { DebugBlock } from './debug-block';
import { RuntimeRow } from './runtime-row';
import { UninstallAgentDialog } from './uninstall-dialog';

/**
 * Which Agent runtimes exist, how far each has got through preparation, and
 * what the account allowance stands at. The panel itself only composes: the
 * per-runtime rows, the allowance, the confirm dialog, and the development
 * block each own their own presentation.
 */

export interface AgentRuntimesPanelProps {
  agentRuntimeApi: AgentRuntimePort;
}

export function AgentRuntimesPanel({ agentRuntimeApi }: AgentRuntimesPanelProps) {
  const runtimes = useAgentRuntimes(agentRuntimeApi);
  const [uninstallTarget, setUninstallTarget] = useState<AgentRuntime | null>(null);

  const onAction = (action: AgentRuntimeAction, runtime: AgentRuntime) => {
    if (action.kind === 'login') runtimes.login(runtime.id);
    else if (action.kind === 'install' || action.kind === 'retry') runtimes.install(runtime.id);
    // 'account' has no in-app sign-in surface yet in this renderer; nothing
    // to dispatch to until that Settings-owned account flow exists.
  };

  const confirmUninstall = () => {
    const id = uninstallTarget?.id;
    if (!id || id === 'stashbase') return;
    runtimes.uninstall(id, () => setUninstallTarget(null));
  };

  const { allowance, catalog } = runtimes;

  return (
    <SettingsPane
      lede="Wiki Agent includes free credits through your fixed 7-day account allowance. Codex and Claude Code remain available as bring-your-own runtimes."
      title="Agents"
    >
      {(allowance.allowance || allowance.failed) && (
        <SettingsGroup title="Allowance">
          <SettingsList>
            {allowance.allowance ? (
              <AllowanceRow allowance={allowance.allowance} onRefresh={runtimes.refreshAllowance} />
            ) : (
              <SettingsRow
                title={
                  <span className="font-normal text-muted-foreground">
                    Agent usage is temporarily unavailable.
                  </span>
                }
                trail={
                  <Button onClick={runtimes.refreshAllowance} size="compact" variant="ghost">
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
          {catalog.loading && (
            <li className="px-3.5 py-2.5 text-caption text-muted-foreground">
              Checking agent runtimes…
            </li>
          )}
          {catalog.failed && (
            <li className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-caption text-muted-foreground">
              <span>Agent runtimes are unavailable.</span>
              <Button onClick={runtimes.refreshCatalog} size="compact" variant="ghost">
                Retry
              </Button>
            </li>
          )}
          {catalog.runtimes.map((runtime) => (
            <RuntimeRow
              busy={runtimes.busy(runtime.id)}
              failure={runtimes.failure(runtime.id)}
              key={runtime.id}
              onAction={onAction}
              onUninstall={setUninstallTarget}
              runtime={runtime}
            />
          ))}
        </SettingsList>
      </SettingsGroup>

      <DebugBlock runtimes={runtimes} />

      <UninstallAgentDialog
        failure={runtimes.uninstallFailure(uninstallTarget?.id ?? null)?.message ?? null}
        onCancel={() => setUninstallTarget(null)}
        onConfirm={confirmUninstall}
        pending={runtimes.uninstalling(uninstallTarget?.id ?? null)}
        runtime={uninstallTarget}
      />
    </SettingsPane>
  );
}
