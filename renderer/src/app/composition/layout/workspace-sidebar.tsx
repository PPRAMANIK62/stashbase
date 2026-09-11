/**
 * The window's left column: the library picker, the panel navigator, and the
 * Gallery, Settings, and account entries at its foot.
 *
 * Every panel it can show is bound here — the file tree to its transport, the
 * chats list to the agent catalog, search to its retrieval ports — so the
 * navigator itself only decides which of them is on screen.
 */
import { Store } from 'lucide-react';

import type { SettingsCommand } from '@/app/composition/commands/use-workspace-commands';
import type { SidebarNavigatorState } from '@/app/composition/commands/use-workspace-commands';
import { useDependencies } from '@/app/composition/dependency-context';
import type { DocumentSources } from '@/app/composition/folder/use-document-sources';
import {
  Sidebar,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar-menu';
import {
  AgentChats,
  ChatNavButtons,
  NewChatButton,
  type AgentScope,
  type AgentWorkspaceRuntime,
} from '@/features/agent/public';
import type { DocumentTabsRuntime } from '@/features/documents/public';
import type { FolderSearchReadiness } from '@/features/preparation/public';
import { LibrarySearch } from '@/features/retrieval/public';
import { SidebarAccountRow } from '@/features/settings/public';
import {
  FileTree,
  LibrarySidebar,
  type ActiveLibraryFolder,
  type FileTreeRowMarker,
  type WorkspaceRuntime,
} from '@/features/workspace/public';
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
  /** Opens the Gallery over this window. The folder stays where it is. */
  onBrowseGallery(): void;
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
  onBrowseGallery,
  onReprocess,
  settings,
  sources,
  workspace,
}: WorkspaceSidebarProps) {
  const dependencies = useDependencies();
  return (
    <Sidebar className="bg-surface-1" variant="inset">
      <SidebarHeader className="gap-0 p-0">
        {/* The titlebar band: traffic lights on macOS, then the collapse
         *  control right of them — the same corner the workspace titlebar
         *  shows the reopening trigger in once the sidebar is away. The band
         *  is the whole header: no wordmark, because the welcome screen
         *  carries the brand and a folder window's first row should be the
         *  folder. */}
        {/* pl-1.5 (6px) + the square's 10px glyph inset = the sidebar's
         *  shared 16px glyph column (folder row, tree, footer), for when no
         *  traffic lights claim the corner (fullscreen, non-macOS); with
         *  lights present the shell.css darwin rule widens the padding past
         *  them. */}
        <div className="workspace-titlebar flex h-11 shrink-0 items-center pr-2 pl-1.5">
          {/* No gap of its own: the buttons' square padding already spaces
           *  the glyphs, keeping the trio a tighter cluster than the room
           *  between it and the traffic lights. */}
          <div className="workspace-titlebar-controls flex items-center">
            <SidebarTrigger aria-label="Hide files sidebar" />
            {activeFolder && <ChatNavButtons runtime={agent.runtime} />}
          </div>
          {/* New chat holds the band's right end while the sidebar is on
           *  screen; collapsed, the workspace titlebar carries it beside the
           *  reopening trigger instead. */}
          {activeFolder && (
            <div className="workspace-titlebar-controls ml-auto flex items-center">
              <NewChatButton
                catalog={dependencies.agent.catalog}
                runtime={agent.runtime}
                scope={agent.scope}
              />
            </div>
          )}
        </div>
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
          {/* Rules bracket the foot: one sets the Gallery shelf off from the
           *  panel above, one sets the person off from the shelf. Settings
           *  lives inside the account menu rather than as a standing row. */}
          <li className="mx-2 my-1 h-px bg-border" role="none" />
          <SidebarMenuItem>
            <SidebarMenuButton icon={Store} onClick={onBrowseGallery}>
              Gallery
            </SidebarMenuButton>
          </SidebarMenuItem>
          <li className="mx-2 my-1 h-px bg-border" role="none" />
          <SidebarAccountRow
            accountApi={dependencies.settings.accountApi}
            agentRuntimeApi={dependencies.settings.agentRuntimeApi}
            onOpenExternal={(href) => void dependencies.documents.openExternal(href)}
            onOpenSettings={() => settings.openSettings()}
          />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
