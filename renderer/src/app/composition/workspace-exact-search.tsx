import { useCallback } from 'react';

import { openDocument } from '@/app/workflows/open-document';
import type { DocumentTabsRuntime } from '@/features/documents/public';
import {
  ExactSearch,
  type ExactSearchApi,
  type ExactSearchNavigationIntent,
} from '@/features/retrieval/public';
import type { WorkspaceRuntime } from '@/features/workspace/public';

export interface WorkspaceExactSearchProps {
  active: boolean;
  activeFolderPath: string;
  api: ExactSearchApi;
  documents: DocumentTabsRuntime | null;
  focusRevision: number;
  workspace: WorkspaceRuntime | null;
}

export function WorkspaceExactSearch({
  active,
  activeFolderPath,
  api,
  documents,
  focusRevision,
  workspace,
}: WorkspaceExactSearchProps) {
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
    <ExactSearch
      active={active}
      activeFolderPath={activeFolderPath}
      api={api}
      focusRevision={focusRevision}
      onNavigate={navigate}
    />
  );
}
