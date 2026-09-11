/**
 * The sidebar's account row, at the foot of the window's left column.
 *
 * Signed out it is one button that starts the browser sign-in, because the
 * account exists for OpenQuill's free credits and there is nothing else to
 * decide. Signed in the row and its menu wear the same initials disc — the
 * theme's ink around the name's first letters, never a provider picture —
 * and the menu holds the credits, Settings, and sign-out. The same sign-in the Agents
 * section runs, through the same port, so the two entries can never
 * disagree.
 */
import { useQuery } from '@tanstack/react-query';
import { Gauge, LogOut, Settings as SettingsIcon, UserRound } from 'lucide-react';

import {
  DropdownContent,
  DropdownLabel,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar-menu';
import type { AccountPort, AgentRuntimePort } from '@/features/settings/application/ports';
import { agentAllowanceQuery } from '@/features/settings/application/queries';
import { accountLabel } from '@/features/settings/domain/account';
import { useAccount } from '@/features/settings/hooks/use-account';
import { ProgressBar } from '@/features/settings/ui/rows';
import { FailureNotice } from '@/shared/ui/failure-notice';

import { AccountAvatar } from './account-avatar';

export interface SidebarAccountRowProps {
  accountApi: AccountPort;
  agentRuntimeApi: AgentRuntimePort;
  onOpenExternal(href: string): void;
  /** Opens Settings — the menu is its sidebar home, not a standing row. */
  onOpenSettings(): void;
}

export function SidebarAccountRow({
  accountApi,
  agentRuntimeApi,
  onOpenExternal,
  onOpenSettings,
}: SidebarAccountRowProps) {
  const account = useAccount(accountApi, onOpenExternal);
  const person = account.account;
  const signedIn = person?.signedIn ?? false;
  const credits = useQuery({ ...agentAllowanceQuery(agentRuntimeApi), enabled: signedIn });

  if (!person || !signedIn) {
    return (
      <>
        {/* No account, no menu — Settings keeps a standing row so the
         *  complete local workspace stays reachable signed out. */}
        <SidebarMenuItem>
          <SidebarMenuButton icon={SettingsIcon} label="Settings" onClick={onOpenSettings} />
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            disabled={account.busy || person === null}
            icon={UserRound}
            label={account.signInPending ? 'Waiting for browser…' : 'Sign in'}
            onClick={() => account.signIn()}
          />
          {account.failure && <FailureNotice className="px-2 pb-1" failure={account.failure} />}
        </SidebarMenuItem>
      </>
    );
  }

  const label = accountLabel(person);
  const percent =
    credits.data === undefined
      ? null
      : Math.max(0, Math.min(100, Math.round(credits.data.remainingPercent)));
  return (
    <SidebarMenuItem>
      <DropdownMenu disabled={account.busy}>
        <DropdownTrigger
          render={
            <SidebarMenuButton
              aria-label={`Account: ${label}`}
              label={label}
              // 20px in the 16px glyph slot: the negative margins keep the
              // slot's footprint (and the label column) while the disc
              // overhangs a pixel each side, so two letters get room.
              leading={<AccountAvatar account={person} className="-mx-0.5" size={20} />}
            />
          }
        />
        <DropdownContent align="start" className="w-72" side="top">
          <DropdownLabel className="flex items-center gap-2.5 text-foreground">
            <AccountAvatar account={person} size={32} />
            <span className="min-w-0">
              <span className="block truncate font-medium">{label}</span>
              {person.email && person.email !== label && (
                <span className="block truncate text-muted-foreground">{person.email}</span>
              )}
            </span>
          </DropdownLabel>
          <DropdownSeparator />
          <DropdownLabel>
            <span className="flex items-center justify-between gap-3 text-foreground">
              <span className="flex items-center gap-2 font-medium">
                <Gauge
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                  strokeWidth={1.5}
                />
                OpenQuill credits
              </span>
              <span className="text-muted-foreground">
                {percent !== null ? `${percent}%` : credits.isError ? 'Unavailable' : '…'}
              </span>
            </span>
            {percent !== null && <ProgressBar className="mt-1.5" value={percent} />}
          </DropdownLabel>
          <DropdownSeparator />
          <MenuItem icon={SettingsIcon} label="Settings" onSelect={onOpenSettings} />
          <MenuItem icon={LogOut} label="Sign out" onSelect={() => account.signOut()} />
        </DropdownContent>
      </DropdownMenu>
      {account.failure && <FailureNotice className="px-2 pb-1" failure={account.failure} />}
    </SidebarMenuItem>
  );
}
