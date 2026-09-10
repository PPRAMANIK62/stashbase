/**
 * The workspace window's composition root. It owns no behaviour of its own:
 * it publishes the adapter record, calls one binder per capability, and
 * decides which of their results each region of the layout is handed. A rule
 * that belongs to a feature belongs in that feature, and a rule about the
 * window belongs in a hook under `./composition`.
 */
import { useEffect } from 'react';

import { useAgentComposerFocused, useAgentWorkspaceRuntime } from '@/features/agent/public';
import {
  RecoveryDrafts,
  useDocumentCommands,
  useDocumentSaveBarrier,
} from '@/features/documents/public';
import { useFolderStatus } from '@/features/preparation/public';
import { useSearchSetupInvitation } from '@/features/settings/public';
import {
  LibraryWelcome,
  useFiles,
  useHiddenFiles,
  useLibrary,
  useWorkspace,
  useWorkspaceSession,
} from '@/features/workspace/public';

import { useComposerFocusSignal } from './composition/commands/use-capture-focus';
import { usePreparationCommands } from './composition/commands/use-preparation-commands';
import { useWorkspaceCommands } from './composition/commands/use-workspace-commands';
import { DependencyProvider, useDependencies } from './composition/dependency-context';
import { useAgentEnvironment } from './composition/folder/use-agent-environment';
import { useDocumentSources } from './composition/folder/use-document-sources';
import { useDocumentWorkspace } from './composition/folder/use-document-workspace';
import { useFolderReadiness } from './composition/folder/use-folder-readiness';
import { useFolderRefresh } from './composition/folder/use-folder-refresh';
import { useRecoveryDrafts } from './composition/folder/use-recovery-drafts';
import { WorkspaceDialogs } from './composition/layout/workspace-dialogs';
import { WorkspaceLayout } from './composition/layout/workspace-layout';
import { useGalleryShop } from './composition/gallery/use-gallery-shop';
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
  const dependencies = useDependencies();
  // Two adapter records this function hands on more than once.
  const { documents: docs, workspace: workspaceDeps } = dependencies;
  useAppearanceSurface(dependencies.settings.appearanceApi);
  const session = useWorkspaceSession(
    workspaceDeps.adapters.library,
    workspaceDeps.adapters.session,
    workspaceDeps.adapters.lifecycle,
  );
  const library = useLibrary(workspaceDeps.adapters.library).data ?? null;
  const workspace = useWorkspace(workspaceDeps.adapters.library, session);
  const documents = useDocumentWorkspace(
    workspace,
    session,
    docs.adapters.source,
    docs.createId,
    docs.adapters.recovery,
  );
  useDocumentCommands(documents?.navigation ?? null, documents);
  useDocumentSaveBarrier(documents, docs.adapters.windowLifecycle);
  const sources = useDocumentSources(workspaceDeps.adapters, workspace, documents);
  const recovery = useRecoveryDrafts(workspace, documents, docs.adapters.recovery);

  const activeFolder = library?.activeFolder ?? null;
  const selectedPath = activeFolder?.path ?? null;
  const folderPath = workspace?.scope.folder.path ?? null;
  const listing = useFiles(workspace, workspaceDeps.adapters.files).data;
  const status = useFolderStatus(dependencies.preparation.statusApi, folderPath).data ?? null;
  const folder = useFolderReadiness(listing, status);
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
    createId: docs.createId,
    folderPath: selectedPath,
    onFilesChanged: refresh.onAgentFilesChanged,
    session: dependencies.agent.session,
    subscribeFolderRemoved: workspaceDeps.adapters.lifecycle.onFolderRemoved,
  });
  useEffect(() => runtime.setScopeEnvironment(agent.environment), [agent.environment, runtime]);
  useComposerFocusSignal(dependencies.capture, useAgentComposerFocused());

  // `not-set-up` is the one semantic state that means no source is configured;
  // until the folder's status answers at all, the question is unanswered
  // rather than false, so the offer holds instead of flashing.
  const searchSetup = useSearchSetupInvitation(dependencies.settings.onboardingApi, {
    configured: status === null ? null : status.semantic.state !== 'not-set-up',
    folderActive: folderPath !== null,
  });

  const chrome = useWorkspaceCommands({
    documents,
    hostFailure: sources.hostFailure,
    library,
    preparation,
    searchSetup: searchSetup.open ? searchSetup : null,
    session,
    workspace,
  });

  const gallery = useGalleryShop(dependencies.gallery);

  return (
    <WorkspaceLayout
      dialogs={
        <>
        {gallery.surfaces}
        <WorkspaceDialogs
          activeFolderPath={selectedPath}
          documents={documents}
          onImported={refresh.refresh}
          quickOpen={chrome.quickOpen}
          settings={chrome.settings}
          workspace={workspace}
        />
        </>
      }
      hasActiveFolder={activeFolder !== null}
      notices={chrome.notices}
      recovery={recovery ? <RecoveryDrafts runtime={recovery} /> : null}
      panes={
        <WorkspacePanes
          agent={{ outline: agent.outline, runtime }}
          documents={documents}
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
              ? { disabled: hiddenFiles.pending, shown: hiddenFiles.showHiddenFiles, toggle: hiddenFiles.toggle }
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
      titlebar={<WorkspaceTitlebar agent={runtime} documents={documents} />}
      welcome={
        <LibraryWelcome
          {...dependencies.library}
          gallery={gallery.band}
          githubImport={workspaceDeps.adapters.githubImport}
          isRestoringSession={session.status.kind === 'restoring'}
        />
      }
    />
  );
}
