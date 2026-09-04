import { useCallback, useMemo } from 'react';

import { openDocument } from '@/app/workflows/open-document';
import type { DocumentTabsRuntime } from '@/features/documents/public';
import {
  QuickOpen,
  type QuickOpenNavigationIntent,
  type QuickOpenSource,
} from '@/features/retrieval/public';
import {
  fileIsRestricted,
  useFiles,
  useReveal,
  type FilesApi,
  type WorkspaceRuntime,
} from '@/features/workspace/public';

export interface WorkspaceQuickOpenProps {
  documents: DocumentTabsRuntime;
  filesApi: FilesApi;
  onClose(): void;
  open: boolean;
  revealLabel: string;
  workspace: WorkspaceRuntime;
}

export function WorkspaceQuickOpen({
  documents,
  filesApi,
  onClose,
  open,
  revealLabel,
  workspace,
}: WorkspaceQuickOpenProps) {
  const files = useFiles(workspace, filesApi);
  const reveal = useReveal(workspace, filesApi);
  const sources = useMemo<QuickOpenSource[]>(
    () =>
      (files.data?.files ?? []).map((file) => ({
        action: fileIsRestricted(file) ? 'reveal' : 'open',
        retrievalAccess: file.format === 'generic' ? 'excluded' : 'included',
        source: { folderPath: workspace.scope.folder.path, path: file.path },
      })),
    [files.data?.files, workspace.scope.folder.path],
  );

  const navigate = useCallback(
    async (intent: QuickOpenNavigationIntent) => {
      if (intent.source.folderPath !== workspace.scope.folder.path) return false;
      if (intent.type === 'reveal-source') return reveal.reveal(intent.source.path);
      return (await openDocument(workspace, documents, intent.source)) !== null;
    },
    [documents, reveal, workspace],
  );

  return (
    <QuickOpen
      folderName={files.data?.folderName ?? workspace.scope.folder.name}
      onClose={onClose}
      onNavigate={navigate}
      onRetry={() => void files.refetch()}
      open={open}
      revealLabel={revealLabel}
      sources={sources}
      status={files.isPending ? 'loading' : files.isError ? 'unavailable' : 'ready'}
    />
  );
}
