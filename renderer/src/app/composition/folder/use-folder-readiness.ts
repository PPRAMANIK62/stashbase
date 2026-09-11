import { useMemo } from 'react';

import {
  folderSearchReadiness,
  sourceReadiness,
  treeMarker,
  type FolderIndexStatus,
  type FolderSearchReadiness,
} from '@/features/preparation/public';
import type { FileTreeRowMarker, WorkspaceListing } from '@/features/workspace/public';

export interface FolderReadiness {
  /** One marker per file the tree should annotate; files that are current
   *  carry none. */
  rowMarkers: Record<string, FileTreeRowMarker>;
  /** Preparation's own answer for the surfaces that search the folder. */
  search: FolderSearchReadiness;
}

/** What the folder's preparation status means for the two places that read it:
 *  a per-row marker in the file tree, and the folder-wide projection the
 *  sidebar and the search panel share. Preparation owns both derivations; this
 *  hook decides when they are recomputed, and applies the one rule the window
 *  owns: search by meaning exists only while the reader's own key is on
 *  (`searchKeyConfigured` true), so on anything else the folder reads as not
 *  set up whatever the daemon is doing in the background. */
export function useFolderReadiness(
  listing: WorkspaceListing | undefined,
  status: FolderIndexStatus | null,
  searchKeyConfigured: boolean | null,
): FolderReadiness {
  const rowMarkers = useMemo(() => {
    const markers: Record<string, FileTreeRowMarker> = {};
    if (!listing || !status) return markers;
    for (const file of listing.files) {
      const marker = treeMarker(sourceReadiness(status, file.path));
      if (marker) markers[file.path] = marker;
    }
    return markers;
  }, [listing, status]);

  const search = useMemo(() => {
    const readiness = folderSearchReadiness(status);
    return searchKeyConfigured === true
      ? readiness
      : { ...readiness, semantic: { state: 'not-set-up' as const } };
  }, [searchKeyConfigured, status]);

  return { rowMarkers, search };
}
