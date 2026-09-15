/**
 * The workspace window's composition root. It owns no behaviour of its own:
 * it publishes the adapter record, calls one binder per capability, and
 * decides which of their results each region of the layout is handed. A rule
 * that belongs to a feature belongs in that feature, and a rule about the
 * window belongs in a hook under `./composition`.
 */
import { useEffect, useState } from 'react';

import { useAgentWorkspaceRuntime } from '@/features/agent/public';
import {
  useDocumentCommands,
  useDocumentSaveBarrier,
  useNewTab,
} from '@/features/documents/public';
import { useFolderStatus } from '@/features/preparation/public';
import { AccountProvider, useSearchKeyConfigured } from '@/features/settings/public';
import { UpdateNotice, useUpdateNotice } from '@/features/updates/public';
import {
  ProjectWelcome,
  useFiles,
  useHiddenFiles,
  useProject,
  useWorkspace,
  useWorkspaceSession,
} from '@/features/workspace/public';

import { usePreparationCommands } from './composition/commands/use-preparation-commands';
import { useWorkspaceCommands } from './composition/commands/use-workspace-commands';
import { DependencyProvider, useDependencies } from './composition/dependency-context';
import { useAgentEnvironment } from './composition/folder/use-agent-environment';
import { useDocumentSources } from './composition/folder/use-document-sources';
import { useDocumentWorkspace } from './composition/folder/use-document-workspace';
import { useFolderReadiness } from './composition/folder/use-folder-readiness';
import { useFolderRefresh } from './composition/folder/use-folder-refresh';
import { useTreeFollowsDocument } from './composition/folder/use-tree-follows-document';
import { useGalleryShop } from './composition/gallery/use-gallery-shop';
import { WorkspaceDialogs } from './composition/layout/workspace-dialogs';
import { WorkspaceLayout } from './composition/layout/workspace-layout';
import { WorkspacePanes } from './composition/layout/workspace-panes';
import { WorkspaceSidebar } from './composition/layout/workspace-sidebar';
import { WorkspaceTitlebar } from './composition/layout/workspace-titlebar';
import { useAppearanceSurface } from './composition/use-appearance-surface';
import type { AppDependencies } from './dependencies';
import { ShellBoundary } from './shell-boundary';

/** The window's root: it publishes the adapter record and nothing else. Every
 *  binder below reads what it needs from that one mechanism, so no component
 *  is handed a port it only passes on. The boundary between them contains a
 *  failure in the window's composition, leaving the dependency record and the
 *  providers above it mounted. */
export function App({ dependencies }: { dependencies: AppDependencies }) {
  return (
    <DependencyProvider dependencies={dependencies}>
      <ShellBoundary>
        <WorkspaceWindow />
      </ShellBoundary>
    </DependencyProvider>
  );
}

/** The workspace window, assembled. Every behaviour lives in a hook under
 *  `./composition` and every port in a binder beside it; this function only
 *  decides what each one is given. */
function WorkspaceWindow() {
  const [chatPaneOpen, setChatPaneOpen] = useState(true);
  const dependencies = useDependencies();
  // Two adapter records this function hands on more than once.
  const { documents: docs, workspace: workspaceDeps } = dependencies;
  useAppearanceSurface(dependencies.settings.appearanceApi);
  useEffect(() => dependencies.recordUsage({ event: 'app_opened' }), [dependencies]);
  const session = useWorkspaceSession(
    workspaceDeps.adapters.project,
    workspaceDeps.adapters.session,
    workspaceDeps.adapters.lifecycle,
  );
  const project = useProject(workspaceDeps.adapters.project).data ?? null;
  const workspace = useWorkspace(workspaceDeps.adapters.project, session);
  const documents = useDocumentWorkspace(workspace, session, docs.adapters.source, docs.createId);
  useDocumentCommands(documents?.navigation ?? null, documents);
  useDocumentSaveBarrier(documents, docs.adapters.windowLifecycle);
  const newTab = useNewTab(documents);
  const sources = useDocumentSources(workspaceDeps.adapters, workspace, documents);
  // The tree's selection is the document in front of the reader, not the
  // last row that was clicked, so a tab switch, a reused preview, or the last
  // tab closing all show in the sidebar.
  useTreeFollowsDocument(workspace, documents);

  const activeFolder = project?.activeFolder ?? null;
  const selectedPath = activeFolder?.path ?? null;
  const folderPath = workspace?.scope.folder.path ?? null;
  const listing = useFiles(workspace, workspaceDeps.adapters.files).data;
  const status = useFolderStatus(dependencies.preparation.statusApi, folderPath).data ?? null;
  // Search by meaning exists only once the reader's own key is on. The
  // window reads that once, and every folder's readiness is projected through
  // it, so no folder shows the mode before the key is there.
  const searchKey = useSearchKeyConfigured(dependencies.settings.embedderApi);
  const folder = useFolderReadiness(listing, status, searchKey);
  // The visibility the listing on screen was built with, so the menu and the
  // rows beside it can never disagree.
  const hiddenFiles = useHiddenFiles(
    workspaceDeps.adapters.preferences,
    listing?.showHiddenFiles ?? false,
    folderPath,
  );
  const preparation = usePreparationCommands(dependencies.preparation.controlApi);
  const refresh = useFolderRefresh({
    folderPath,
    reprocessSource: preparation.reprocess,
    syncFolder: preparation.sync,
    treeVersion: status?.treeVersion,
  });

  const agent = useAgentEnvironment(listing, status, documents, folderPath, selectedPath);
  const runtime = useAgentWorkspaceRuntime({
    context: dependencies.agent.context,
    recordUsage: dependencies.recordUsage,
    createId: docs.createId,
    folderPath: selectedPath,
    onFilesChanged: refresh.onAgentFilesChanged,
    session: dependencies.agent.session,
    subscribeFolderRemoved: workspaceDeps.adapters.lifecycle.onFolderRemoved,
  });
  useEffect(() => runtime.setScopeEnvironment(agent.environment), [agent.environment, runtime]);

  const chrome = useWorkspaceCommands({
    documents,
    hostFailure: sources.hostFailure,
    project,
    preparation,
    session,
    workspace,
  });

  const gallery = useGalleryShop(dependencies.gallery);
  const updateNotice = useUpdateNotice(dependencies.updates);
  // A new draft is the tree's to make, beside its selection, and its name is
  // typed in the tree, so the request brings the Files panel on screen
  // before the tree takes it up. It starts from the New tab's page; the
  // draft opening in front is what closes that tab.
  const newDraft = () => {
    session.runtime.setSidebarOpen(true);
    chrome.navigator.select('files');
    workspace?.requestCreate('draft');
  };

  return (
    // One account for the window: the sidebar's footer row, the composer's
    // runtime picker, and Settings all read the same open sign-in rather than
    // each starting one of their own.
    <AccountProvider
      openExternal={(href) => void dependencies.documents.openExternal(href)}
      port={dependencies.settings.accountApi}
    >
      <WorkspaceLayout
        dialogs={
          <>
            {gallery.surfaces}
            <WorkspaceDialogs
              documents={documents}
              quickOpen={chrome.quickOpen}
              settings={chrome.settings}
              workspace={workspace}
            />
          </>
        }
        hasActiveFolder={activeFolder !== null}
        notices={chrome.notices}
        panes={
          <WorkspacePanes
            chatPaneOpen={chatPaneOpen}
            agent={{ outline: agent.outline, runtime }}
            documents={documents}
            mode={chrome.navigator.mode}
            newTab={newTab}
            onCreateDraft={newDraft}
            onPrepare={preparation.prepare}
            onReprocess={refresh.reprocess}
            session={session}
            settings={chrome.settings}
            sources={sources}
            status={status}
          />
        }
        session={session}
        sidebar={
          <WorkspaceSidebar
            activeFolder={activeFolder}
            agent={{ runtime, scope: agent.scope }}
            documents={documents}
            folder={{
              ...folder,
              hiddenFiles: listing
                ? {
                    disabled: hiddenFiles.pending,
                    shown: hiddenFiles.showHiddenFiles,
                    toggle: hiddenFiles.toggle,
                  }
                : null,
            }}
            navigator={chrome.navigator}
            onBrowseGallery={gallery.browse}
            onReprocess={refresh.reprocess}
            settings={chrome.settings}
            sources={sources}
            workspace={workspace}
          />
        }
        started={chrome.started}
        titlebar={
          <WorkspaceTitlebar
            agent={runtime}
            chatPaneOpen={chatPaneOpen}
            newTab={newTab}
            onToggleChatPane={() => setChatPaneOpen((open) => !open)}
            documents={documents}
            hasActiveFolder={activeFolder !== null}
            mode={chrome.navigator.mode}
          />
        }
        updateNotice={<UpdateNotice notice={updateNotice} />}
        welcome={
          <ProjectWelcome
            {...dependencies.project}
            gallery={gallery.band}
            githubImport={workspaceDeps.adapters.githubImport}
            isRestoringSession={session.status.kind === 'restoring'}
          />
        }
      />
    </AccountProvider>
  );
}
