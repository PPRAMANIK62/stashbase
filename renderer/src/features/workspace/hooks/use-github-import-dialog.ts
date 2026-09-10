import { useState } from 'react';

import type { GitHubImportPort } from '@/features/workspace/application/ports';
import {
  useGitHubImport,
  type GitHubImportView,
} from '@/features/workspace/hooks/use-github-import';

export interface GitHubImportDialogView {
  /** True while the dialog is on screen. */
  readonly open: boolean;
  readonly request: GitHubImportView;
  close(): void;
  start(): void;
}

/**
 * The Import from GitHub dialog, as both ways into it use it.
 *
 * A published folder closes the dialog and is then opened through the same
 * lane every other folder change uses, so the save barrier and abandonment
 * rules apply to it rather than to a second path around them.
 */
export function useGitHubImportDialog(
  port: GitHubImportPort,
  selectFolder: (path: string) => void,
): GitHubImportDialogView {
  const [open, setOpen] = useState(false);
  const request = useGitHubImport(port, {
    onImported: (path) => {
      setOpen(false);
      selectFolder(path);
    },
  });

  return {
    close: () => setOpen(false),
    open,
    request,
    start: () => setOpen(true),
  };
}
