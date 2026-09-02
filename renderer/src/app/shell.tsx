import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  FileTree,
  LibrarySidebar,
  LibraryWelcome,
  useLibraryLifecycle,
  useWorkspace,
} from '@/features/workspace/public';
import { Logo } from '@/shared/brand/logo';

import type { AppDependencies } from './dependencies';

import './shell.css';

export function App({ dependencies }: { dependencies: AppDependencies }) {
  const workspace = useWorkspace(dependencies.library.api);
  const libraryLifecycle = useLibraryLifecycle(
    dependencies.library.api,
    dependencies.library.lifecycle,
    workspace,
  );

  return (
    <SidebarProvider
      className="workspace-shell h-svh min-h-0 overflow-hidden bg-surface-1"
      persist={false}
      width="15rem"
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
          <div className="min-w-0 flex-1 px-2 text-center">
            <span className="text-caption font-medium text-muted-foreground">Agent</span>
          </div>
          <div aria-hidden="true" className="size-9 shrink-0" />
        </header>

        <section aria-label="Agent workspace" className="min-h-0 flex-1">
          <LibraryWelcome {...dependencies.library} />
        </section>
      </SidebarInset>
    </SidebarProvider>
  );
}
