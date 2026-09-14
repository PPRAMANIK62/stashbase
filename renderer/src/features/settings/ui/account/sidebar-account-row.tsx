/**
 * The sidebar's account row, at the foot of the window's left column.
 *
 * Signed out it is one button that starts the browser sign-in for free
 * OpenQuill credits. Signed in the row and its menu wear the same initials disc — the
 * theme's ink around the name's first letters, never a provider picture —
 * and the menu holds the credits, Settings, and sign-out. The same sign-in the Agents
 * section runs, through the same port, so the two entries can never
 * disagree.
 */
import { useQuery } from '@tanstack/react-query';
import { Gauge, LogOut, Settings as SettingsIcon, UserRound, X } from 'lucide-react';

import {
  DropdownContent,
  DropdownLabel,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar-menu';
import type { AgentRuntimePort } from '@/features/settings/application/ports';
import { agentAllowanceQuery } from '@/features/settings/application/queries';
import { accountLabel } from '@/features/settings/domain/account';
import { useAccountView } from '@/features/settings/hooks/account-context';
import { ProgressBar } from '@/features/settings/ui/rows';
import { useSize } from '@/lib/size-context';
import { cn } from '@/lib/utils';
import { FailureNotice } from '@/shared/ui/failure-notice';
import { clamp } from '@/shared/utils/clamp';

import { AccountAvatar } from './account-avatar';

export interface SidebarAccountRowProps {
  agentRuntimeApi: AgentRuntimePort;
  /** Opens Settings — the menu is its sidebar home, not a standing row. */
  onOpenSettings(): void;
}

/** The menu hangs off the account row and is read as the bottom of the left
 *  column, so its rows keep the sidebar's own geometry rather than the compact
 *  step's tighter menu spacing: the 8px inset and 8px glyph gap that
 *  sidebar-menu-button writes, around the same 14px glyph. Without it a menu
 *  row's label sat 6px left of the sidebar label directly beneath it. */
const SIDEBAR_ROW = 'gap-2 px-2';

export function SidebarAccountRow({ agentRuntimeApi, onOpenSettings }: SidebarAccountRowProps) {
  const account = useAccountView();
  // The menu inherits the sidebar's compact step through the portal, so its
  // glyphs are the column's own 14px. Only the icon size comes from the step:
  // the inset and the glyph gap are the sidebar's, not the step's — see
  // SIDEBAR_ROW below.
  const sizeClasses = useSize();
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
            label={
              account.signInPending ? (
                'Waiting for browser…'
              ) : (
                // Two tones in one label: the action rests in the row's ink
                // and the reason steps back behind it, so the row scans as
                // "Sign in" at a glance and still answers "for what?" without
                // a second line. The row's own rule is untouched — hover and
                // selection recolour nothing.
                <>
                  {'Sign in '}
                  <span className="text-muted-foreground">for free OpenQuill credits</span>
                </>
              )
            }
            onClick={() => account.signIn()}
          />
          {account.canStopWaiting && (
            <SidebarMenuAction
              aria-label="Stop waiting"
              onClick={account.stopWaiting}
              title="Stop waiting"
            >
              <X aria-hidden="true" />
            </SidebarMenuAction>
          )}
          {account.failure && <FailureNotice className="px-2 pb-1" failure={account.failure} />}
        </SidebarMenuItem>
      </>
    );
  }

  const label = accountLabel(person);
  const percent =
    credits.data === undefined ? null : clamp(Math.round(credits.data.remainingPercent), 0, 100);
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
            <span
              className={cn(
                'flex items-center justify-between gap-3 text-foreground',
                sizeClasses.text,
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <Gauge
                  aria-hidden="true"
                  className="text-muted-foreground"
                  size={sizeClasses.icon}
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
          <MenuItem
            className={SIDEBAR_ROW}
            icon={SettingsIcon}
            label="Settings"
            onSelect={onOpenSettings}
          />
          <MenuItem
            className={SIDEBAR_ROW}
            icon={LogOut}
            label="Sign out"
            onSelect={() => account.signOut()}
          />
        </DropdownContent>
      </DropdownMenu>
      {account.failure && <FailureNotice className="px-2 pb-1" failure={account.failure} />}
    </SidebarMenuItem>
  );
}
