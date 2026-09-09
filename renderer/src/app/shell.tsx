import { useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import { SplitHandle } from '@/components/ui/split-handle';
import {
  AgentChats,
  AgentTitlebar,
  AgentWorkspace,
  type AgentScopeEnvironment,
  type AgentScopeOutline,
  type AgentWorkspaceProps,
  useAgentWorkspaceRuntime,
} from '@/features/agent/public';
import {
  DocumentTabs,
  DocumentWorkspace,
  useDocumentSaveBarrier,
} from '@/features/documents/public';
import {
  folderPreparationSummary,
  folderStatusQueryKey,
  SourcePreparationStatus,
  sourceReadiness,
  treeMarker,
  useFolderStatus,
} from '@/features/preparation/public';
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
  workspaceQueryKeys,
  type FileTreeRowMarker,
} from '@/features/workspace/public';
import { applyCaptureWatch } from '@/platform/electron/capture';
import { Logo } from '@/shared/brand/logo';
import type { SourceReference } from '@/shared/domain/source-reference';

import { ClipboardOffer, useComposerFocusSignal } from './composition/clipboard-offer';
import { SidebarNavigator } from './composition/sidebar-navigator';
import { useDocumentCommands } from './composition/use-document-commands';
import { useDocumentWorkspace } from './composition/use-document-workspace';
import { useQuickOpenCommand } from './composition/use-quick-open-command';
import { useSettingsCommand } from './composition/use-settings-command';
import { useSidebarSearchCommand } from './composition/use-sidebar-search-command';
import { WorkspaceQuickOpen } from './composition/workspace-quick-open';
import { WorkspaceSearch } from './composition/workspace-search';
import type { AppDependencies } from './dependencies';
import { openDocument } from './workflows/open-document';

import './shell.css';

const AGENT_WORKSPACE_SELECTOR = 'section[aria-label="Agent workspace"]';

/** True while a text field inside the Agent workspace owns focus, so a
 *  clipboard image pasted into the composer is never also offered as an import. */
function useAgentComposerFocused(): boolean {
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    const update = () => {
      const active = document.activeElement;
      setFocused(
        active instanceof HTMLTextAreaElement && active.closest(AGENT_WORKSPACE_SELECTOR) !== null,
      );
    };
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);
  return focused;
}

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
    context: dependencies.agent.context,
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
  const queryClient = useQueryClient();
  const workspaceFolderPath = workspace?.scope.folder.path ?? null;
  const folderStatus = useFolderStatus(dependencies.preparation.statusApi, workspaceFolderPath);
  const status = folderStatus.data ?? null;
  const treeVersion = status?.treeVersion;
  const seenTreeVersion = useRef<{ folder: string | null; version: number | undefined }>({
    folder: null,
    version: undefined,
  });
  useEffect(() => {
    if (treeVersion === undefined || !workspaceFolderPath) return;
    const seen = seenTreeVersion.current;
    seenTreeVersion.current = { folder: workspaceFolderPath, version: treeVersion };
    if (seen.folder !== workspaceFolderPath || seen.version === undefined) return;
    if (seen.version === treeVersion) return;
    void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.files(workspaceFolderPath) });
  }, [queryClient, treeVersion, workspaceFolderPath]);
  const refreshFolderState = useCallback(() => {
    if (!workspaceFolderPath) return;
    void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.files(workspaceFolderPath) });
    void queryClient.invalidateQueries({ queryKey: folderStatusQueryKey(workspaceFolderPath) });
  }, [queryClient, workspaceFolderPath]);
  const rowMarkers = useMemo(() => {
    if (!listing || !status) return undefined;
    const markers: Record<string, FileTreeRowMarker> = {};
    for (const file of listing.files) {
      const marker = treeMarker(sourceReadiness(status, file.path));
      if (marker) markers[file.path] = marker;
    }
    return markers;
  }, [listing, status]);
  const preparationSummary = useMemo(() => folderPreparationSummary(status), [status]);
  const reprocessSource = useCallback(
    (source: SourceReference) => {
      const controller = new AbortController();
      void dependencies.preparation.controlApi
        .reprocess(source, {}, controller.signal)
        .catch(() => undefined)
        .finally(refreshFolderState);
    },
    [dependencies.preparation.controlApi, refreshFolderState],
  );
  const prepareOnOpen = useCallback(
    (source: SourceReference) => {
      const controller = new AbortController();
      void dependencies.preparation.controlApi
        .prepare(source, controller.signal)
        .catch(() => undefined);
    },
    [dependencies.preparation.controlApi],
  );
  const composerFocused = useAgentComposerFocused();
  useComposerFocusSignal(dependencies.capture, composerFocused);
  const agentScopeOutline = useMemo<AgentScopeOutline | null>(() => {
    if (!listing) return null;
    const topLevel = (path: string) => !path.includes('/');
    return {
      files: listing.files.map((file) => file.path).filter(topLevel),
      folders: listing.folders.map((folder) => folder.path).filter(topLevel),
    };
  }, [listing]);
  // The Agent feature validates bound context against the folder it can see
  // without importing workspace or preparation state: the shell publishes one
  // snapshot of the selected folder's listing and per-source readiness.
  const agentScopeEnvironment = useMemo<AgentScopeEnvironment | null>(() => {
    if (!listing || !workspaceFolderPath) return null;
    const readiness: Record<string, AgentScopeEnvironment['readiness'][string]> = {};
    if (status) {
      for (const file of listing.files) {
        const kind = sourceReadiness(status, file.path).kind;
        if (kind !== 'current') readiness[file.path] = kind;
      }
    }
    return {
      folderPath: workspaceFolderPath,
      listing: {
        files: listing.files.map((file) => ({ format: file.format, path: file.path })),
        folders: listing.folders
          .filter((folder) => folder.kind === 'normal')
          .map((folder) => folder.path),
      },
      readiness,
      versions: status?.conversionVersions ?? {},
    };
  }, [listing, status, workspaceFolderPath]);
  useEffect(
    () => agentRuntime.setScopeEnvironment(agentScopeEnvironment),
    [agentRuntime, agentScopeEnvironment],
  );
  const agentProps: AgentWorkspaceProps = {
    catalog: dependencies.settings.agentRuntimeApi,
    onOpenExternal: (href) => void dependencies.documents.openExternal(href),
    onOpenAgentSettings: () => settings.openSettings('agents'),
    onReprocess: reprocessSource,
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
        applyCaptureWatch={(expected) => applyCaptureWatch(dependencies.capture, expected)}
        captureApi={dependencies.settings.captureApi}
        embedderApi={dependencies.settings.embedderApi}
        onClose={settings.close}
        onOpenExternal={(href) => void dependencies.documents.openExternal(href)}
        onSectionChange={settings.onSectionChange}
        open={settings.open}
        section={settings.section}
        transcriptionApi={dependencies.settings.transcriptionApi}
      />
      <ClipboardOffer
        activeFolderPath={selectedFolderPath}
        bridge={dependencies.capture}
        onImported={refreshFolderState}
        uploadApi={dependencies.workspace.uploadApi}
      />
      <Sidebar className="bg-surface-1" variant="inset">
        <SidebarHeader className="workspace-titlebar h-11 flex-row items-center gap-2.5 px-4 py-0">
          <Logo aria-hidden="true" className="size-7 shrink-0" />
          <span className="text-title font-semibold tracking-tight">StashBase</span>
        </SidebarHeader>
        <SidebarGroup className="shrink-0 pb-0">
          <LibrarySidebar
            {...dependencies.library}
            attention={preparationSummary.needsAttention}
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
              <WorkspaceSearch
                active={sidebarNavigatorIndex === 2}
                activeFolderPath={library.data.activeFolder.path}
                decisionApi={dependencies.retrieval.decisionApi}
                documents={documents}
                exactApi={dependencies.retrieval.exactSearchApi}
                focusRevision={searchFocusRevision}
                onOpenSettings={(section) => settings.openSettings(section)}
                preparation={preparationSummary}
                semanticApi={dependencies.retrieval.semanticSearchApi}
                status={status}
                workspace={workspace}
              />
            }
            selectedIndex={sidebarNavigatorIndex}
          >
            {workspace ? (
              <FileTree
                api={dependencies.workspace.api}
                key={workspace.scope.generation}
                onOpenSource={(source) => {
                  if (documents) void openDocument(workspace, documents, source);
                }}
                onReprocess={reprocessSource}
                onScopeLost={libraryLifecycle.recoverLostScope}
                revealLabel={dependencies.workspace.revealLabel}
                rowMarkers={rowMarkers}
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
                        onOpenPrepared={prepareOnOpen}
                        onReveal={(source, signal) =>
                          dependencies.workspace.api.reveal(source.folderPath, source.path, signal)
                        }
                        renderPreparation={(source, format) => (
                          <SourcePreparationStatus
                            controlApi={dependencies.preparation.controlApi}
                            format={format}
                            source={source}
                            status={status}
                          />
                        )}
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
