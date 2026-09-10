import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { WorkspacePreferencesPort } from '@/features/workspace/application/ports';
import { refreshFolderListing } from '@/features/workspace/application/queries';
import { useRequestSignals } from '@/shared/runtime/use-request-signals';

export interface HiddenFilesView {
  /** The visibility the listing on screen was built with. Read from the
   *  listing rather than held here, so the menu can never disagree with the
   *  rows beside it. */
  readonly showHiddenFiles: boolean;
  /** True while a write is open. The row stays visible and stops responding
   *  rather than disappearing mid-gesture. */
  readonly pending: boolean;
  toggle(): void;
}

/**
 * The Workbench's hidden-entry visibility.
 *
 * The preference is application-level and the server owns it, so this only
 * asks and then re-reads. On success the open folder's listing is invalidated
 * directly instead of waiting for the shared tree-version poll to notice: the
 * reader just asked for this, and up to eight seconds of nothing happening
 * would read as a broken control. Other windows still converge on that poll.
 *
 * A refused or failed write changes nothing. The listing keeps whatever the
 * server last applied, which is the honest thing to show.
 */
export function useHiddenFiles(
  port: WorkspacePreferencesPort,
  applied: boolean,
  folderPath: string | null,
): HiddenFilesView {
  const client = useQueryClient();
  const signalFor = useRequestSignals<'set-visibility'>();
  const write = useMutation({
    mutationFn: (next: boolean) => port.setShowHiddenFiles(next, signalFor('set-visibility')),
    onSuccess: async () => {
      if (folderPath) await refreshFolderListing(client, folderPath);
    },
  });

  const { isPending, mutate } = write;
  const toggle = useCallback(() => {
    if (isPending) return;
    mutate(!applied);
  }, [applied, isPending, mutate]);

  return { pending: isPending, showHiddenFiles: applied, toggle };
}
