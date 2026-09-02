import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { DocumentTabs, DocumentWorkspace } from '@/features/documents/public';
import {
  FileTree,
  LibrarySidebar,
  LibraryWelcome,
  useLibraryLifecycle,
  usePersistWorkspaceSession,
  useWorkspace,
  useWorkspaceSession,
} from '@/features/workspace/public';
import { Logo } from '@/shared/brand/logo';

import { useDocumentWorkspace } from './composition/use-document-workspace';
import type { AppDependencies } from './dependencies';
import { openDocument } from './workflows/open-document';

import './shell.css';

export function App({ dependencies }: { dependencies: AppDependencies }) {
  const session = useWorkspaceSession(dependencies.library.api, dependencies.session);
  const workspace = useWorkspace(dependencies.library.api, session.restoredFolder, session.isReady);
  usePersistWorkspaceSession(session.runtime, workspace);
  const documents = useDocumentWorkspace(
    workspace,
    session.restoredFolder,
    session.runtime,
    dependencies.documents.createId,
  );
  const libraryLifecycle = useLibraryLifecycle(
    dependencies.library.api,
    dependencies.library.lifecycle,
    workspace,
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
      <Sidebar className="bg-surface-1" variant="inset">
        <SidebarHeader className="workspace-titlebar h-11 flex-row items-center gap-2.5 px-4 py-0">
          <Logo aria-hidden="true" className="size-7 shrink-0" />
          <span className="text-title font-semibold tracking-tight">StashBase</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <LibrarySidebar {...dependencies.library} />
            {workspace && (
              <FileTree
                {...dependencies.workspace}
                key={workspace.scope.generation}
                onOpenSource={(source) => {
                  if (documents) openDocument(workspace, documents, source);
                }}
                onScopeLost={libraryLifecycle.recoverLostScope}
                runtime={workspace}
              />
            )}
          </SidebarGroup>
        </SidebarContent>
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
          {documents && <DocumentWorkspace runtime={documents} />}
          <LibraryWelcome
            {...dependencies.library}
            isRestoringSession={session.isRestoringFolder}
          />
        </section>
      </SidebarInset>
    </SidebarProvider>
  );
}
