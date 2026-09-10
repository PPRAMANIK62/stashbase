import type { SettingsCommand } from '@/app/composition/commands/use-workspace-commands';
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
import { DocumentWorkspace, type DocumentTabsRuntime } from '@/features/documents/public';
import { SourcePreparationStatus, type FolderIndexStatus } from '@/features/preparation/public';
import type { WorkspaceSessionController } from '@/features/workspace/public';
import type { SourceReference } from '@/shared/domain/source-reference';

import { AgentDocumentWorkspace } from './agent-document-workspace';

export interface WorkspacePanesProps {
  agent: { outline: AgentScopeOutline | null; runtime: AgentWorkspaceRuntime };
  documents: DocumentTabsRuntime | null;
  onPrepare(source: SourceReference): void;
  onReprocess(source: SourceReference): void;
  session: WorkspaceSessionController;
  settings: SettingsCommand;
  sources: DocumentSources;
  status: FolderIndexStatus | null;
}

export function WorkspacePanes({
  agent,
  documents,
  onPrepare,
  onReprocess,
  session,
  settings,
  sources,
  status,
}: WorkspacePanesProps) {
  const dependencies = useDependencies();
  return (
    <AgentDocumentWorkspace
      agent={
        <AgentWorkspace
          catalog={dependencies.agent.catalog}
          instructions={dependencies.agent.instructions}
          onOpenAgentSettings={() => settings.openSettings('agents')}
          onOpenExternal={(href) => void dependencies.documents.openExternal(href)}
          onOpenSource={sources.open}
          onReprocess={onReprocess}
          runtime={agent.runtime}
          scopeOutline={agent.outline}
        />
      }
      onPaneWidthChange={session.runtime.setAgentPaneWidth}
      paneWidth={session.shell.agentPaneWidth}
      runtime={documents}
      document={
        documents ? (
          <DocumentWorkspace
            assetApi={dependencies.documents.adapters.asset}
            docxPreviewApi={dependencies.documents.adapters.docxPreview}
            genericPreviewApi={dependencies.documents.adapters.genericPreview}
            mediaApi={dependencies.documents.adapters.media}
            onNavigate={sources.navigate}
            onOpenExternal={dependencies.documents.openExternal}
            onOpenPrepared={onPrepare}
            onReveal={(source, signal) =>
              dependencies.workspace.adapters.files.reveal(source.folderPath, source.path, signal)
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
        ) : null
      }
    />
  );
}
