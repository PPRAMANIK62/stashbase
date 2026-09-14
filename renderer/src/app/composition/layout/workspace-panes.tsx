import type {
  SettingsCommand,
  SidebarMode,
} from '@/app/composition/commands/use-workspace-commands';
import { useDependencies } from '@/app/composition/dependency-context';
import type { DocumentSources } from '@/app/composition/folder/use-document-sources';
/**
 * The Agent beside the open document.
 *
 * Both panes are bound to their ports here — the Agent to its catalog and
 * scope outline, the document to every viewer transport and to preparation —
 * so the split row itself only owns the seam between them.
 */
import {
  AgentWorkspace,
  type AgentScopeOutline,
  type AgentWorkspaceRuntime,
} from '@/features/agent/public';
import {
  DocumentWorkspace,
  NewTabPage,
  type DocumentTabsRuntime,
  type NewTab,
} from '@/features/documents/public';
import { SourcePreparationStatus, type FolderIndexStatus } from '@/features/preparation/public';
import { useAccountView } from '@/features/settings/public';
import type { WorkspaceSessionController } from '@/features/workspace/public';
import type { SourceReference } from '@/shared/domain/source-reference';

import { AgentDocumentWorkspace } from './agent-document-workspace';

export interface WorkspacePanesProps {
  chatPaneOpen: boolean;
  agent: { outline: AgentScopeOutline | null; runtime: AgentWorkspaceRuntime };
  documents: DocumentTabsRuntime | null;
  /** The sidebar mode. In Chats the Agent has the whole card and no name
   *  row of its own; in Documents it docks beside the open document. */
  mode: SidebarMode;
  /** The strip's New tab; its page covers the document slot while it is
   *  selected. */
  newTab: NewTab;
  /** What the New tab's page starts: a draft beside the tree's selection. */
  onCreateDraft(): void;
  onPrepare(source: SourceReference): void;
  onReprocess(source: SourceReference): void;
  session: WorkspaceSessionController;
  settings: SettingsCommand;
  sources: DocumentSources;
  status: FolderIndexStatus | null;
}

export function WorkspacePanes({
  agent,
  chatPaneOpen,
  documents,
  mode,
  newTab,
  onCreateDraft,
  onPrepare,
  onReprocess,
  session,
  settings,
  sources,
  status,
}: WorkspacePanesProps) {
  const dependencies = useDependencies();
  const account = useAccountView();
  return (
    <AgentDocumentWorkspace
      chatPaneOpen={chatPaneOpen}
      documentsShown={mode === 'documents'}
      newTabOpen={newTab.open}
      agent={
        <AgentWorkspace
          catalog={dependencies.agent.catalog}
          header={mode === 'documents'}
          instructions={dependencies.agent.instructions}
          onOpenAgentSettings={() => settings.openSettings('agents')}
          onOpenExternal={(href) => void dependencies.documents.openExternal(href)}
          onOpenSource={sources.open}
          onReprocess={onReprocess}
          // The bundled runtime's only gate is the account, so the picker's
          // row starts the same browser sign-in the sidebar's footer row does.
          onSignIn={account.signIn}
          runtime={agent.runtime}
          scopeOutline={agent.outline}
        />
      }
      onPaneWidthChange={session.runtime.setAgentPaneWidth}
      paneWidth={session.shell.agentPaneWidth}
      runtime={documents}
      document={
        documents ? (
          // The New tab's page lies over the document rather than replacing
          // it, so the editors underneath keep their state for its close.
          <div className="relative h-full">
            <div aria-hidden={newTab.open} className="h-full" inert={newTab.open}>
              <DocumentWorkspace
                assetApi={dependencies.documents.adapters.asset}
                docxPreviewApi={dependencies.documents.adapters.docxPreview}
                genericPreviewApi={dependencies.documents.adapters.genericPreview}
                mediaApi={dependencies.documents.adapters.media}
                onNavigate={sources.navigate}
                onOpenExternal={dependencies.documents.openExternal}
                onOpenPrepared={onPrepare}
                onReveal={(source, signal) =>
                  dependencies.workspace.adapters.files.reveal(
                    source.folderPath,
                    source.path,
                    signal,
                  )
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
                sourceApi={dependencies.documents.adapters.source}
              />
            </div>
            {newTab.open && (
              <NewTabPage
                className="absolute inset-0"
                onClose={newTab.close}
                onCreateDraft={onCreateDraft}
              />
            )}
          </div>
        ) : null
      }
    />
  );
}
