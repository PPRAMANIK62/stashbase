import { Settings as SettingsIcon } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import {
  Sidebar,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar-menu';
import {
  AgentChats,
  AgentTitlebar,
  AgentWorkspace,
  type AgentScopeOutline,
  type AgentWorkspaceProps,
  useAgentWorkspaceRuntime,
} from '@/features/agent/public';
import {
  DocumentTabs,
  DocumentWorkspace,
  useDocumentSaveBarrier,
} from '@/features/documents/public';
import { SplitHandle } from '@/components/ui/split-handle';
import { Settings } from '@/features/settings/public';
import {
  DEFAULT_AGENT_PANE_WIDTH,
  FileTree,
  LibrarySidebar,
  LibraryWelcome,
  MAX_AGENT_PANE_WIDTH,
  MIN_AGENT_PANE_WIDTH,
  useFiles,
  useLibraryLifecycle,
  useLibrary,
  usePersistWorkspaceSession,
  useWorkspace,
  useWorkspaceSession,
} from '@/features/workspace/public';
import { Logo } from '@/shared/brand/logo';

import { SidebarNavigator } from './composition/sidebar-navigator';
import { useDocumentCommands } from './composition/use-document-commands';
import { useDocumentWorkspace } from './composition/use-document-workspace';
import { useQuickOpenCommand } from './composition/use-quick-open-command';
import { useSettingsCommand } from './composition/use-settings-command';
import { useSidebarSearchCommand } from './composition/use-sidebar-search-command';
import { WorkspaceExactSearch } from './composition/workspace-exact-search';
import { WorkspaceQuickOpen } from './composition/workspace-quick-open';
import type { AppDependencies } from './dependencies';
import { openDocument } from './workflows/open-document';

import './shell.css';

function AgentDocumentWorkspace({
  agent,
  document,
  onPaneWidthChange,
  paneWidth,
  runtime,
}: {
  agent: AgentWorkspaceProps;
  document: ReactNode;
  onPaneWidthChange(width: number): void;
  paneWidth: number;
  runtime: ReturnType<typeof useDocumentWorkspace>;
}) {
  const subscribe = useCallback(
    (listener: () => void) => runtime?.store.subscribe(listener) ?? (() => undefined),
    [runtime],
  );
  const snapshot = useCallback(() => (runtime?.store.getState().tabs.length ?? 0) > 0, [runtime]);
  const hasDocuments = useSyncExternalStore(subscribe, snapshot, snapshot);
  if (!hasDocuments) return <AgentWorkspace {...agent} />;
  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1">{document}</div>
      <div
        className="relative h-full max-w-[calc(100%-20rem)] shrink-0 border-l border-border"
        style={{ width: paneWidth }}
      >
        <SplitHandle
          className="left-0 -translate-x-1/2"
          defaultWidth={DEFAULT_AGENT_PANE_WIDTH}
          label="Resize Agent pane"
          max={MAX_AGENT_PANE_WIDTH}
          min={MIN_AGENT_PANE_WIDTH}
          onWidthChange={onPaneWidthChange}
          pane="right"
          width={paneWidth}
        />
        <AgentWorkspace {...agent} />
      </div>
    </div>
  );
}

export function App({ dependencies }: { dependencies: AppDependencies }) {
  const session = useWorkspaceSession(dependencies.library.api, dependencies.session);
  const library = useLibrary(dependencies.library.api);
  const workspace = useWorkspace(dependencies.library.api, session.restoredFolder, session.isReady);
  usePersistWorkspaceSession(session.runtime, workspace);
  const documents = useDocumentWorkspace(
    workspace,
    session.restoredFolder,
    session.runtime,
    dependencies.documents.sourceApi,
    dependencies.documents.createId,
  );
  const settings = useSettingsCommand();
  useEffect(() => {
    if (!session.isReady || session.isRestoringFolder || !library.data) return;
    document.body.dataset.bootSettled = '1';
  }, [library.data, session.isReady, session.isRestoringFolder]);
  const [agentStarted, setAgentStarted] = useState(false);
  useEffect(() => {
    if ((library.data?.members.length ?? 0) > 0) setAgentStarted(true);
  }, [library.data?.members.length]);
  const quickOpen = useQuickOpenCommand(
    workspace && documents
      ? `${workspace.scope.folder.path}\u0000${workspace.scope.generation}`
      : null,
  );
  const [sidebarNavigatorIndex, setSidebarNavigatorIndex] = useState(0);
  const [searchFocusRevision, setSearchFocusRevision] = useState(0);
  const openSearch = useCallback(() => {
    session.runtime.setSidebarOpen(true);
    setSidebarNavigatorIndex(2);
    setSearchFocusRevision((revision) => revision + 1);
  }, [session.runtime]);
  useSidebarSearchCommand((library.data?.members.length ?? 0) > 0, openSearch);
  useDocumentCommands(documents?.navigation ?? null);
  useDocumentSaveBarrier(documents, dependencies.documents.lifecycle);
  const saveDocumentsForFolder = useCallback(
    (folderPath: string) =>
      documents?.scope.folderPath === folderPath ? documents.flush() : Promise.resolve(true),
    [documents],
  );
  const libraryLifecycle = useLibraryLifecycle(
    dependencies.library.api,
    dependencies.library.lifecycle,
    workspace,
    saveDocumentsForFolder,
  );
  const selectedFolderPath = library.data?.activeFolder?.path ?? null;
  const agentRuntime = useAgentWorkspaceRuntime({
    createId: dependencies.documents.createId,
    folderPath: selectedFolderPath,
    session: dependencies.agent.session,
    subscribeFolderRemoved: dependencies.library.lifecycle.onFolderRemoved,
  });
  const selectedAgentScope = useMemo(
    () =>
      selectedFolderPath
        ? ({ kind: 'folder', path: selectedFolderPath } as const)
        : ({ kind: 'library' } as const),
    [selectedFolderPath],
  );
  const listing = useFiles(workspace, dependencies.workspace.api).data;
  const agentScopeOutline = useMemo<AgentScopeOutline | null>(() => {
    if (!listing) return null;
    const topLevel = (path: string) => !path.includes('/');
    return {
      files: listing.files.map((file) => file.path).filter(topLevel),
      folders: listing.folders.map((folder) => folder.path).filter(topLevel),
    };
  }, [listing]);
  const agentProps: AgentWorkspaceProps = {
    catalog: dependencies.settings.agentRuntimeApi,
    onOpenExternal: (href) => void dependencies.documents.openExternal(href),
    onOpenAgentSettings: () => settings.openSettings('agents'),
    runtime: agentRuntime,
    scopeOutline: agentScopeOutline,
  };

  return (
    <SidebarProvider
      className="workspace-shell h-svh min-h-0 overflow-hidden bg-surface-1"
      persist={false}
      onOpenChange={session.runtime.setSidebarOpen}
      onWidthChange={(width) => {
        const pixels = Number.parseFloat(width);
        if (Number.isFinite(pixels)) session.runtime.setSidebarWidth(pixels);
      }}
      open={session.shell.sidebarOpen}
      width={`${session.shell.sidebarWidth}px`}
    >
      {workspace && documents && (
        <WorkspaceQuickOpen
          documents={documents}
          filesApi={dependencies.workspace.api}
          onClose={quickOpen.close}
          open={quickOpen.open}
          revealLabel={dependencies.workspace.revealLabel}
          workspace={workspace}
        />
      )}
      <Settings
        agentRuntimeApi={dependencies.settings.agentRuntimeApi}
        onClose={settings.close}
        onSectionChange={settings.onSectionChange}
        open={settings.open}
        section={settings.section}
      />
      <Sidebar className="bg-surface-1" variant="inset">
        <SidebarHeader className="workspace-titlebar h-11 flex-row items-center gap-2.5 px-4 py-0">
          <Logo aria-hidden="true" className="size-7 shrink-0" />
          <span className="text-title font-semibold tracking-tight">StashBase</span>
        </SidebarHeader>
        <SidebarGroup className="shrink-0 pb-0">
          <LibrarySidebar
            {...dependencies.library}
            beforeFolderChange={() =>
              workspace
                ? saveDocumentsForFolder(workspace.scope.folder.path)
                : Promise.resolve(true)
            }
          />
        </SidebarGroup>
        {library.data?.activeFolder && (
          <SidebarNavigator
            chats={
              sidebarNavigatorIndex === 3 ? (
                <AgentChats
                  catalog={dependencies.settings.agentRuntimeApi}
                  onOpenAgentSettings={() => settings.openSettings('agents')}
                  runtime={agentRuntime}
                  scope={selectedAgentScope}
                  workspaceName={library.data.activeFolder.name}
                />
              ) : null
            }
            onSelect={setSidebarNavigatorIndex}
            runtime={documents}
            search={
              <WorkspaceExactSearch
                active={sidebarNavigatorIndex === 2}
                activeFolderPath={library.data.activeFolder.path}
                api={dependencies.retrieval.exactSearchApi}
                documents={documents}
                focusRevision={searchFocusRevision}
                workspace={workspace}
              />
            }
            selectedIndex={sidebarNavigatorIndex}
          >
            {workspace ? (
              <FileTree
                {...dependencies.workspace}
                key={workspace.scope.generation}
                onOpenSource={(source) => {
                  if (documents) void openDocument(workspace, documents, source);
                }}
                onScopeLost={libraryLifecycle.recoverLostScope}
                runtime={workspace}
              />
            ) : (
              <p className="px-4 py-2 text-caption text-muted-foreground">Loading files…</p>
            )}
          </SidebarNavigator>
        )}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton icon={SettingsIcon} onClick={() => settings.openSettings()}>
                Settings
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-h-0 overflow-hidden">
        <header className="workspace-titlebar flex h-11 shrink-0 items-center border-b border-border px-2">
          <div className="workspace-titlebar-controls">
            <SidebarTrigger aria-label="Toggle files sidebar" />
          </div>
          <div className="flex min-w-0 flex-1 px-2">
            {documents ? (
              <DocumentTabs
                className="workspace-titlebar-controls max-w-full"
                emptyContent={<AgentTitlebar runtime={agentRuntime} />}
                runtime={documents}
              />
            ) : (
              <AgentTitlebar runtime={agentRuntime} />
            )}
          </div>
          <div aria-hidden="true" className="size-9 shrink-0" />
        </header>

        <section aria-label="Agent workspace" className="min-h-0 flex-1">
          {library.data && agentStarted ? (
            <div className="h-full min-h-0">
              <div className={library.data.activeFolder ? 'h-full min-h-0' : 'hidden'}>
                <AgentDocumentWorkspace
                  agent={agentProps}
                  onPaneWidthChange={session.runtime.setAgentPaneWidth}
                  paneWidth={session.shell.agentPaneWidth}
                  runtime={documents}
                  document={
                    documents ? (
                      <DocumentWorkspace
                        assetApi={dependencies.documents.assetApi}
                        docxPreviewApi={dependencies.documents.docxPreviewApi}
                        genericPreviewApi={dependencies.documents.genericPreviewApi}
                        mediaApi={dependencies.documents.mediaApi}
                        onNavigate={(target) => {
                          if (workspace) {
                            void openDocument(workspace, documents, target.source, {
                              anchor: target.anchor,
                            });
                          }
                        }}
                        onOpenExternal={dependencies.documents.openExternal}
                        onReveal={(source, signal) =>
                          dependencies.workspace.api.reveal(source.folderPath, source.path, signal)
                        }
                        revealLabel={dependencies.workspace.revealLabel}
                        runtime={documents}
                        sourceApi={dependencies.documents.sourceApi}
                      />
                    ) : null
                  }
                />
              </div>
              {!library.data.activeFolder && (
                <LibraryWelcome
                  {...dependencies.library}
                  isRestoringSession={session.isRestoringFolder}
                />
              )}
            </div>
          ) : (
            <LibraryWelcome
              {...dependencies.library}
              isRestoringSession={session.isRestoringFolder}
            />
          )}
        </section>
      </SidebarInset>
    </SidebarProvider>
  );
}
