import { useCallback } from 'react';

import { openDocument } from '@/app/workflows/open-document';
import type { DocumentTabsRuntime } from '@/features/documents/public';
import {
  LibrarySearch,
  type ExactSearchApi,
  type ExactSearchNavigationIntent,
  type IndexDecisionApi,
  type PreparationCounts,
  type SemanticSearchApi,
} from '@/features/retrieval/public';
import type { WorkspaceRuntime } from '@/features/workspace/public';
import type { FolderIndexStatus } from '@/shared/domain/folder-index-status';

export interface WorkspaceSearchProps {
  active: boolean;
  activeFolderPath: string;
  decisionApi: IndexDecisionApi;
  documents: DocumentTabsRuntime | null;
  exactApi: ExactSearchApi;
  focusRevision: number;
  onOpenSettings(section: 'ai-index' | 'transcription'): void;
  preparation: PreparationCounts;
  semanticApi: SemanticSearchApi;
  status: FolderIndexStatus | null;
  workspace: WorkspaceRuntime | null;
}

export function WorkspaceSearch({
  active,
  activeFolderPath,
  decisionApi,
  documents,
  exactApi,
  focusRevision,
  onOpenSettings,
  preparation,
  semanticApi,
  status,
  workspace,
}: WorkspaceSearchProps) {
  const navigate = useCallback(
    async (intent: ExactSearchNavigationIntent) => {
      if (!workspace || !documents) return false;
      return (
        (await openDocument(workspace, documents, intent.source, { search: intent.target })) !==
        null
      );
    },
    [documents, workspace],
  );

  return (
    <LibrarySearch
      active={active}
      activeFolderPath={activeFolderPath}
      decisionApi={decisionApi}
      exactApi={exactApi}
      focusRevision={focusRevision}
      onNavigate={navigate}
      onOpenSettings={onOpenSettings}
      preparation={preparation}
      semanticApi={semanticApi}
      status={status}
    />
  );
}
