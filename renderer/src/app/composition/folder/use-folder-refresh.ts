import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import type { AgentFilesChanged } from '@/features/agent/public';
import type { SourceReference } from '@/shared/domain/source-reference';

import { refreshFolder } from './refresh-folder';

export interface FolderRefreshOptions {
  /** The folder the workspace is on, or null while none is open. */
  folderPath: string | null;
  /** Restarts preparation for one source; resolves once the call settled. */
  reprocessSource(source: SourceReference): Promise<void>;
  /** Reconciles a folder with its disk; resolves once the pass has settled. */
  syncFolder(folderPath: string): Promise<void>;
  /** The daemon's tree revision for `folderPath`, or undefined before the
   *  first status poll answers. */
  treeVersion: number | undefined;
}

export interface FolderRefresh {
  /** Files an Agent wrote: show them, reload the documents they touched, then
   *  reconcile the folder's index and readiness. */
  onAgentFilesChanged(change: AgentFilesChanged): void;
  /** Re-reads the open folder's listing and preparation status. */
  refresh(): void;
  /** Restarts preparation for one source and re-reads the folder once the
   *  call has settled. Preparation changes what the tree and the status line
   *  say, so the two always travel together. */
  reprocess(source: SourceReference): void;
}

/**
 * Keeping the open folder's listing honest against writes the window did not
 * make.
 *
 * Two sources disagree with the cache. The daemon publishes a tree revision
 * with every status poll, so a revision that moves means something outside the
 * app touched the folder and the listing has to be re-read — but only after a
 * revision has been seen for *this* folder, otherwise every folder switch would
 * refetch a listing that was just fetched. The other source is the Agent, which
 * reports exactly which files its settled write changed; those are refreshed
 * directly and then reconciled, and nothing here selects a file on its behalf.
 */
export function useFolderRefresh({
  folderPath,
  reprocessSource,
  syncFolder,
  treeVersion,
}: FolderRefreshOptions): FolderRefresh {
  const queryClient = useQueryClient();
  const seenTreeVersion = useRef<{ folder: string | null; version: number | undefined }>({
    folder: null,
    version: undefined,
  });

  useEffect(() => {
    if (treeVersion === undefined || !folderPath) return;
    const seen = seenTreeVersion.current;
    seenTreeVersion.current = { folder: folderPath, version: treeVersion };
    if (seen.folder !== folderPath || seen.version === undefined) return;
    if (seen.version === treeVersion) return;
    refreshFolder(queryClient, folderPath, { listing: true, status: false });
  }, [folderPath, queryClient, treeVersion]);

  const refresh = useCallback(() => {
    if (!folderPath) return;
    refreshFolder(queryClient, folderPath, { listing: true, status: true });
  }, [folderPath, queryClient]);

  const onAgentFilesChanged = useCallback(
    ({ scope, sources }: AgentFilesChanged) => {
      if (scope.kind !== 'folder') return;
      const folder = scope.path;
      refreshFolder(queryClient, folder, { documents: sources, listing: true, status: false });
      void syncFolder(folder).finally(() =>
        refreshFolder(queryClient, folder, { listing: true, status: true }),
      );
    },
    [queryClient, syncFolder],
  );

  const reprocess = useCallback(
    (source: SourceReference) => void reprocessSource(source).finally(refresh),
    [refresh, reprocessSource],
  );

  return { onAgentFilesChanged, refresh, reprocess };
}
