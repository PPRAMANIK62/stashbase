/**
 * The Agents section: the StashBase account, OpenQuill's free credits, and
 * every runtime this window can hold a conversation with.
 *
 * Sign-in lives here because the account exists for OpenQuill. A runtime row
 * that reports it needs an account starts the same browser sign-in the account
 * row does, so the two can never disagree about what signing in means.
 */
import { LogIn, LogOut } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { AccountPort, AgentRuntimePort } from '@/features/settings/application/ports';
import { accountLabel } from '@/features/settings/domain/account';
import type { AgentRuntime } from '@/features/settings/domain/agent-catalog';
import type { AgentRuntimeAction } from '@/features/settings/domain/agent-runtime-status';
import { useAccount, type AccountViewModel } from '@/features/settings/hooks/use-account';
import { useAgentRuntimes } from '@/features/settings/hooks/use-agent-runtimes';
import {
  SettingsGroup,
  SettingsList,
  SettingsPane,
  SettingsRow,
} from '@/features/settings/ui/rows';
import { FailureNotice } from '@/shared/ui/failure-notice';

import { AllowanceRow } from './allowance-row';
import { DebugBlock } from './debug-block';
import { RuntimeRow } from './runtime-row';
import { UninstallAgentDialog } from './uninstall-dialog';

export interface AgentRuntimesPanelProps {
  accountApi: AccountPort;
  agentRuntimeApi: AgentRuntimePort;
  onOpenExternal(href: string): void;
}

function AccountRow({ account }: { account: AccountViewModel }) {
  const signedIn = account.account?.signedIn ?? false;
  return (
    <SettingsRow
      detail={
        account.account === null
          ? 'Checking…'
          : signedIn
            ? [account.account.displayName, account.account.email]
                .filter((part): part is string => part !== null)
                .join(' · ') || accountLabel(account.account)
            : 'Sign in to use OpenQuill with free credits. Codex and Claude Code need no account.'
      }
      title="StashBase account"
      trail={
        signedIn ? (
          <Button
            disabled={account.busy}
            leadingIcon={LogOut}
            onClick={() => account.signOut()}
            size="compact"
            variant="ghost"
          >
            Sign out
          </Button>
        ) : (
          <Button
            disabled={account.busy || account.account === null}
            leadingIcon={LogIn}
            loading={account.signInPending}
            onClick={() => account.signIn()}
            size="compact"
            variant="secondary"
          >
            {account.signInPending ? 'Waiting for browser…' : 'Sign in'}
          </Button>
        )
      }
    >
      {account.failure && <FailureNotice className="mt-1" failure={account.failure} />}
    </SettingsRow>
  );
}

export function AgentRuntimesPanel({
  accountApi,
  agentRuntimeApi,
  onOpenExternal,
}: AgentRuntimesPanelProps) {
  const account = useAccount(accountApi, onOpenExternal);
  const runtimes = useAgentRuntimes(agentRuntimeApi);
  const [uninstallTarget, setUninstallTarget] = useState<AgentRuntime | null>(null);

  const onAction = (action: AgentRuntimeAction, runtime: AgentRuntime) => {
    if (action.kind === 'login') runtimes.login(runtime.id);
    else if (action.kind === 'install' || action.kind === 'retry') runtimes.install(runtime.id);
    else account.signIn();
  };

  const confirmUninstall = () => {
    const id = uninstallTarget?.id;
    if (!id || id === 'stashbase') return;
    runtimes.uninstall(id, () => setUninstallTarget(null));
  };

  const { allowance, catalog } = runtimes;

  return (
    <SettingsPane
      lede="OpenQuill is included and runs on free credits from your StashBase account. Codex and Claude Code remain available as bring-your-own runtimes."
      title="Agents"
    >
      <SettingsGroup title="Account">
        <SettingsList>
          <AccountRow account={account} />
        </SettingsList>
      </SettingsGroup>

      {(allowance.allowance || allowance.failed) && (
        <SettingsGroup title="Credits">
          <SettingsList>
            {allowance.allowance ? (
              <AllowanceRow allowance={allowance.allowance} onRefresh={runtimes.refreshAllowance} />
            ) : (
              <SettingsRow
                title={
                  <span className="font-normal text-muted-foreground">
                    Credits are temporarily unavailable.
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
              busy={runtimes.busy(runtime.id) || (runtime.id === 'stashbase' && account.busy)}
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
