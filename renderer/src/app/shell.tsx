import { useEffect } from 'react';

import { useAgentComposerFocused, useAgentWorkspaceRuntime } from '@/features/agent/public';
import { useDocumentCommands, useDocumentSaveBarrier } from '@/features/documents/public';
import { useFolderStatus } from '@/features/preparation/public';
import {
  LibraryWelcome,
  useFiles,
  useLibrary,
  useWorkspace,
  useWorkspaceSession,
} from '@/features/workspace/public';

import { DependencyProvider, useDependencies } from './composition/dependency-context';
import { useAgentEnvironment } from './composition/folder/use-agent-environment';
import { useComposerFocusSignal } from './composition/commands/use-capture-focus';
import { useDocumentSources } from './composition/folder/use-document-sources';
import { useDocumentWorkspace } from './composition/folder/use-document-workspace';
import { useFolderReadiness } from './composition/folder/use-folder-readiness';
import { useFolderRefresh } from './composition/folder/use-folder-refresh';
import { usePreparationCommands } from './composition/commands/use-preparation-commands';
import { useWorkspaceCommands } from './composition/commands/use-workspace-commands';
import { WorkspaceDialogs } from './composition/layout/workspace-dialogs';
import { WorkspaceLayout } from './composition/layout/workspace-layout';
import { WorkspacePanes } from './composition/layout/workspace-panes';
import { WorkspaceSidebar } from './composition/layout/workspace-sidebar';
import { WorkspaceTitlebar } from './composition/layout/workspace-titlebar';
import type { AppDependencies } from './dependencies';

/** The window's root: it publishes the adapter record and nothing else. Every
 *  binder below reads what it needs from that one mechanism, so no component
 *  is handed a port it only passes on. */
export function App({ dependencies }: { dependencies: AppDependencies }) {
  return (
    <DependencyProvider dependencies={dependencies}>
      <WorkspaceWindow />
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
  const session = useWorkspaceSession(
    workspaceDeps.adapters.library,
    workspaceDeps.adapters.session,
  );
  const library = useLibrary(workspaceDeps.adapters.library).data ?? null;
  const workspace = useWorkspace(workspaceDeps.adapters.library, session);
  const documents = useDocumentWorkspace(workspace, session, docs.adapters.source, docs.createId);
  useDocumentCommands(documents?.navigation ?? null, documents);
  useDocumentSaveBarrier(documents, docs.adapters.windowLifecycle);
  const sources = useDocumentSources(workspaceDeps.adapters, workspace, documents);

  const activeFolder = library?.activeFolder ?? null;
  const selectedPath = activeFolder?.path ?? null;
  const folderPath = workspace?.scope.folder.path ?? null;
  const listing = useFiles(workspace, workspaceDeps.adapters.files).data;
  const status = useFolderStatus(dependencies.preparation.statusApi, folderPath).data ?? null;
  const folder = useFolderReadiness(listing, status);
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

  const chrome = useWorkspaceCommands({
    documents,
    hostFailure: sources.hostFailure,
    library,
    preparation,
    session,
    workspace,
  });

  return (
    <WorkspaceLayout
      dialogs={
        <WorkspaceDialogs
          activeFolderPath={selectedPath}
          documents={documents}
          onImported={refresh.refresh}
          quickOpen={chrome.quickOpen}
          settings={chrome.settings}
          workspace={workspace}
        />
      }
      hasActiveFolder={activeFolder !== null}
      notices={chrome.notices}
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
          folder={folder}
          navigator={chrome.navigator}
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
          isRestoringSession={session.status.kind === 'restoring'}
        />
      }
    />
  );
}
