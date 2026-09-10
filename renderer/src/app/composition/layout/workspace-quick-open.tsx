import { useCallback, useMemo } from 'react';

import { useDependencies } from '@/app/composition/dependency-context';
import { openDocument } from '@/app/workflows/open-document';
import type { DocumentTabsRuntime } from '@/features/documents/public';
import {
  QuickOpen,
  retrievalAccessFor,
  type QuickOpenNavigationIntent,
  type QuickOpenSource,
} from '@/features/retrieval/public';
import {
  fileIsRestricted,
  useFiles,
  useReveal,
  type WorkspaceRuntime,
} from '@/features/workspace/public';

export interface WorkspaceQuickOpenProps {
  documents: DocumentTabsRuntime;
  onClose(): void;
  open: boolean;
  workspace: WorkspaceRuntime;
}

export function WorkspaceQuickOpen({
  documents,
  onClose,
  open,
  workspace,
}: WorkspaceQuickOpenProps) {
  const { adapters, revealLabel } = useDependencies().workspace;
  const files = useFiles(workspace, adapters.files);
  const reveal = useReveal(workspace, adapters.files);
  const sources = useMemo<QuickOpenSource[]>(
    () =>
      (files.data?.files ?? []).map((file) => ({
        action: fileIsRestricted(file) ? 'reveal' : 'open',
        retrievalAccess: retrievalAccessFor(file.format),
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
