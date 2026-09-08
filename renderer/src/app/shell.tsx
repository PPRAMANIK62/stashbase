import { Settings as SettingsIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

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
  DocumentTabs,
  DocumentWorkspace,
  useDocumentSaveBarrier,
} from '@/features/documents/public';
import { Settings } from '@/features/settings/public';
import {
  FileTree,
  LibrarySidebar,
  LibraryWelcome,
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
                emptyContent={
                  <span className="flex-1 text-center text-caption font-medium text-muted-foreground">
                    Agent
                  </span>
                }
                runtime={documents}
              />
            ) : (
              <span className="flex-1 text-center text-caption font-medium text-muted-foreground">
                Agent
              </span>
            )}
          </div>
          <div aria-hidden="true" className="size-9 shrink-0" />
        </header>

        <section aria-label="Agent workspace" className="min-h-0 flex-1">
          {documents && (
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
          )}
          <LibraryWelcome
            {...dependencies.library}
            isRestoringSession={session.isRestoringFolder}
          />
        </section>
      </SidebarInset>
    </SidebarProvider>
  );
}
