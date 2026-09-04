import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  createDocumentQueryScope,
  createDocumentTabsRuntime,
  type DocumentSourceApi,
  type DocumentTabsRuntime,
} from '@/features/documents/public';
import type {
  FolderSessionState,
  WorkspaceRuntime,
  WorkspaceSessionRuntime,
} from '@/features/workspace/public';

export function useDocumentWorkspace(
  workspace: WorkspaceRuntime | null,
  restored: FolderSessionState | null,
  session: WorkspaceSessionRuntime,
  sourceApi: DocumentSourceApi,
  createId: () => string,
): DocumentTabsRuntime | null {
  const queryClient = useQueryClient();
  const [runtime, setRuntime] = useState<DocumentTabsRuntime | null>(null);
  const restoredRef = useRef(restored);
  restoredRef.current = restored;
  const folderPath = workspace?.scope.folder.path ?? null;
  const generation = workspace?.scope.generation ?? null;

  useLayoutEffect(() => {
    if (!workspace || !folderPath || !generation) {
      setRuntime(null);
      return;
    }

    const restoredFolder =
      restoredRef.current?.folderPath === folderPath ? restoredRef.current : null;
    const nextRuntime = createDocumentTabsRuntime({
      api: sourceApi,
      createId,
      createQueries: (scope) => createDocumentQueryScope(queryClient, scope),
      folderPath,
      generation,
      restored: restoredFolder
        ? {
            activeTabId: restoredFolder.activeTabId,
            tabs: restoredFolder.tabs.map((tab) => ({
              id: tab.id,
              source: { folderPath, path: tab.path },
            })),
          }
        : null,
    });
    setRuntime(nextRuntime);
    return () => nextRuntime.dispose();
  }, [createId, folderPath, generation, queryClient, sourceApi, workspace]);

  const current =
    workspace &&
    runtime?.scope.folderPath === workspace.scope.folder.path &&
    runtime.scope.generation === workspace.scope.generation
      ? runtime
      : null;

  useEffect(() => {
    if (!workspace || !current) return;
    const record = () => session.recordWorkspace(workspace.store.getState(), current.toSession());
    record();
    return current.store.subscribe(record);
  }, [current, session, workspace]);

  return current;
}
