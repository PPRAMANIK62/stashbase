/**
 * The window's left column: the library picker, the panel navigator, and the
 * Settings and bug-report entries at its foot.
 *
 * Every panel it can show is bound here — the file tree to its transport, the
 * chats list to the agent catalog, search to its retrieval ports — so the
 * navigator itself only decides which of them is on screen.
 */
import { Bug, Settings as SettingsIcon } from 'lucide-react';

import type { SettingsCommand } from '@/app/composition/commands/use-workspace-commands';
import type { SidebarNavigatorState } from '@/app/composition/commands/use-workspace-commands';
import { useDependencies } from '@/app/composition/dependency-context';
import type { DocumentSources } from '@/app/composition/folder/use-document-sources';
import { Sidebar, SidebarFooter, SidebarGroup, SidebarHeader } from '@/components/ui/sidebar';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar-menu';
import { AgentChats, type AgentScope, type AgentWorkspaceRuntime } from '@/features/agent/public';
import type { DocumentTabsRuntime } from '@/features/documents/public';
import type { FolderSearchReadiness } from '@/features/preparation/public';
import { LibrarySearch } from '@/features/retrieval/public';
import {
  FileTree,
  LibrarySidebar,
  type ActiveLibraryFolder,
  type FileTreeRowMarker,
  type WorkspaceRuntime,
} from '@/features/workspace/public';
import { Logo } from '@/shared/brand/logo';
import type { SourceReference } from '@/shared/domain/source-reference';

import { SidebarNavigator } from './sidebar-navigator';
import { sidebarPanels } from './sidebar-panels';

export interface WorkspaceSidebarProps {
  activeFolder: ActiveLibraryFolder | null;
  agent: { runtime: AgentWorkspaceRuntime; scope: AgentScope };
  documents: DocumentTabsRuntime | null;
  folder: {
    /** The Workbench-wide hidden-entry visibility, offered on the tree's own
     *  space. Null while no folder is listed. */
    hiddenFiles: { readonly disabled: boolean; readonly shown: boolean; toggle(): void } | null;
    rowMarkers: Record<string, FileTreeRowMarker>;
    search: FolderSearchReadiness;
  };
  navigator: SidebarNavigatorState;
  onReprocess(source: SourceReference): void;
  settings: SettingsCommand;
  sources: DocumentSources;
  workspace: WorkspaceRuntime | null;
}

export function WorkspaceSidebar({
  activeFolder,
  agent,
  documents,
  folder,
  navigator: sidebar,
  onReprocess,
  settings,
  sources,
  workspace,
}: WorkspaceSidebarProps) {
  const dependencies = useDependencies();
  const bugReport = dependencies.bugReport;
  return (
    <Sidebar className="bg-surface-1" variant="inset">
      <SidebarHeader className="workspace-titlebar h-11 flex-row items-center gap-2.5 px-4 py-0">
        <Logo aria-hidden="true" className="size-7 shrink-0" />
        <span className="text-title font-semibold tracking-tight">StashBase</span>
      </SidebarHeader>
      <SidebarGroup className="shrink-0 pb-0">
        <LibrarySidebar
          {...dependencies.library}
          attention={folder.search.counts.needsAttention}
          beforeFolderChange={() => sources.saveOpenFolder()}
          githubImport={dependencies.workspace.adapters.githubImport}
        />
      </SidebarGroup>
      {activeFolder && (
        <SidebarNavigator
          onSelect={sidebar.select}
          panels={sidebarPanels({
            chats: (
              <AgentChats
                catalog={dependencies.agent.catalog}
                onOpenAgentSettings={() => settings.openSettings('agents')}
                runtime={agent.runtime}
                scope={agent.scope}
                workspaceName={activeFolder.name}
              />
            ),
            files: workspace ? (
              <FileTree
                api={dependencies.workspace.adapters.files}
                {...(folder.hiddenFiles ? { hiddenFiles: folder.hiddenFiles } : {})}
                key={workspace.scope.generation}
                onOpenSource={sources.open}
                onReprocess={onReprocess}
                onScopeLost={sources.recoverLostScope}
                retireSources={sources.retire}
                revealLabel={dependencies.workspace.revealLabel}
                rowMarkers={folder.rowMarkers}
                runtime={workspace}
              />
            ) : (
              <p className="px-4 py-2 text-caption text-muted-foreground">Loading files…</p>
            ),
            outline: documents,
            search: (
              <LibrarySearch
                active={sidebar.selected === 'search'}
                activeFolderPath={activeFolder.path}
                decisionApi={dependencies.retrieval.decisionApi}
                exactApi={dependencies.retrieval.exactSearchApi}
                focusRevision={sidebar.focusRevision}
                onNavigate={sources.navigateToMatch}
                onOpenSettings={settings.openSettings}
                preparation={folder.search.counts}
                readiness={folder.search.semantic}
                readyCount={folder.search.readyCount}
                semanticApi={dependencies.retrieval.semanticSearchApi}
              />
            ),
          })}
          selected={sidebar.selected}
        />
      )}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton icon={SettingsIcon} onClick={() => settings.openSettings()}>
              Settings
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              disabled={bugReport === null}
              icon={Bug}
              onClick={() => void bugReport?.open()}
            >
              {bugReport ? 'Report a bug' : 'Report a bug (desktop app only)'}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
