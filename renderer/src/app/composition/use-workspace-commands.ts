/**
 * The window's chrome: which sidebar panel is showing, which command surface is
 * open, how far startup has come, and what the notice strip says.
 *
 * None of it belongs to a single feature and all of it answers to the same few
 * inputs, so it is composed once here and the shell only decides what each part
 * is given. The two pieces of state the shell used to reach through two further
 * hooks for — the open Settings section and the selected sidebar panel — are
 * held here directly: a hook whose whole body was a call to another hook made
 * the shell four levels deep to answer "which panel is showing".
 */
import { useCallback, useState } from 'react';

import { useBootProgress } from '@/app/bootstrap/use-boot-progress';
import type { DocumentTabsRuntime } from '@/features/documents/public';
import type { SettingsSectionId } from '@/features/settings/public';
import type {
  LibrarySnapshot,
  WorkspaceRuntime,
  WorkspaceSessionController,
} from '@/features/workspace/public';
import { useCommandSurface, type CommandSurface } from '@/lib/runtime/use-command-surface';

import type { PreparationCommands } from './use-preparation-commands';
import { useQuickOpenCommand } from './use-quick-open-command';
import { useSidebarSearchCommand } from './use-sidebar-search-command';
import { useWorkspaceNotices, type WorkspaceNotice } from './use-workspace-notices';

/** Every panel the sidebar can show. A panel is named, never numbered: the
 *  index the tab strip wants is derived from the registry, so inserting a panel
 *  cannot silently repoint a comparison somewhere else. */
export type SidebarPanelId = 'files' | 'outline' | 'search' | 'chats';

export interface SidebarNavigatorState {
  /** Bumped every time Search is summoned, so the field refocuses even when the
   *  panel was already showing. */
  focusRevision: number;
  /** Opens the sidebar on Search and puts the caret in its field. */
  openSearch(): void;
  select(panel: SidebarPanelId): void;
  selected: SidebarPanelId;
}

export interface SettingsCommand {
  close(): void;
  onSectionChange(id: SettingsSectionId): void;
  open: boolean;
  openSettings(section?: SettingsSectionId): void;
  section: SettingsSectionId;
}

export interface WorkspaceCommands {
  navigator: SidebarNavigatorState;
  /** Refusals raised by work the reader did not ask about directly. */
  notices: readonly WorkspaceNotice[];
  quickOpen: Pick<CommandSurface, 'close' | 'open'>;
  settings: SettingsCommand;
  /** True once the window has settled far enough to show the Agent. */
  started: boolean;
}

const DEFAULT_SECTION: SettingsSectionId = 'agents';

export function useWorkspaceCommands({
  documents,
  hostFailure,
  library,
  preparation,
  session,
  workspace,
}: {
  documents: DocumentTabsRuntime | null;
  hostFailure: string | null;
  library: LibrarySnapshot | null;
  preparation: Pick<PreparationCommands, 'dismissFailure' | 'failure'>;
  session: WorkspaceSessionController;
  workspace: WorkspaceRuntime | null;
}): WorkspaceCommands {
  const memberCount = library?.members.length ?? 0;
  const sidebarRuntime = session.runtime;

  const settingsSurface = useCommandSurface();
  const [section, setSection] = useState<SettingsSectionId>(DEFAULT_SECTION);
  const presentSettings = settingsSurface.present;
  const openSettings = useCallback(
    (next: SettingsSectionId = DEFAULT_SECTION) => {
      setSection(next);
      presentSettings();
    },
    [presentSettings],
  );

  const [selected, setSelected] = useState<SidebarPanelId>('files');
  const [focusRevision, setFocusRevision] = useState(0);
  const openSearch = useCallback(() => {
    sidebarRuntime.setSidebarOpen(true);
    setSelected('search');
    setFocusRevision((revision) => revision + 1);
  }, [sidebarRuntime]);

  useSidebarSearchCommand(memberCount > 0, openSearch);
  const quickOpen = useQuickOpenCommand(workspace, documents);
  const started = useBootProgress({
    memberCount,
    settled: session.status.kind === 'ready' && library !== null,
  });
  const notices = useWorkspaceNotices(preparation.failure, preparation.dismissFailure, hostFailure);

  return {
    navigator: { focusRevision, openSearch, select: setSelected, selected },
    notices,
    quickOpen,
    settings: {
      close: settingsSurface.close,
      onSectionChange: setSection,
      open: settingsSurface.open,
      openSettings,
      section,
    },
    started: started && library !== null,
  };
}
