import type { QueryClient } from '@tanstack/react-query';

import { refreshDocumentSources } from '@/features/documents/public';
import { refreshFolderStatus } from '@/features/preparation/public';
import { refreshFolderListing } from '@/features/workspace/public';
import type { SourceReference } from '@/shared/domain/source-reference';

/** What a refresh has to re-read. A folder's listing, its preparation status
 *  and the documents open on it are owned by three different features, so the
 *  caller names what changed rather than the query keys behind it. */
export interface FolderRefreshTargets {
  /** Reload the open documents behind these sources. */
  readonly documents?: readonly SourceReference[] | undefined;
  /** Re-read the folder's file listing. */
  readonly listing: boolean;
  /** Re-read the folder's preparation status. */
  readonly status: boolean;
}

/**
 * The one way anything asks for a folder's cached views to be re-read.
 *
 * Each feature owns the invalidation of its own keys; this composes them, so
 * "the tree changed" is stated once here instead of being spelled out as a
 * query key at every place that notices a change.
 */
export function refreshFolder(
  queryClient: QueryClient,
  folderPath: string,
  targets: FolderRefreshTargets,
): void {
  if (targets.listing) void refreshFolderListing(queryClient, folderPath);
  if (targets.status) void refreshFolderStatus(queryClient, folderPath);
  if (targets.documents) refreshDocumentSources(queryClient, targets.documents);
}
