import { useCallback, useMemo } from 'react';
import { useStore } from 'zustand';

import type { WorkspaceRuntime } from '@/features/workspace/application/runtime';
import { buildTree, visibleTree, type WorkspaceListing } from '@/features/workspace/domain/tree';
import { selectTreePath, toggleTreeFolder } from '@/features/workspace/domain/workspace';

export function useTree(runtime: WorkspaceRuntime, listing: WorkspaceListing) {
  const expanded = useStore(runtime.store, (state) => state.expanded);
  const selectedPath = useStore(runtime.store, (state) => state.selectedPath);
  const nodes = useMemo(() => buildTree(listing), [listing]);
  const rows = useMemo(() => visibleTree(nodes, expanded), [expanded, nodes]);

  const select = useCallback(
    (path: string) => {
      const capturedScope = runtime.scope;
      runtime.accept(capturedScope, () =>
        runtime.store.setState((state) => selectTreePath(state, path)),
      );
    },
    [runtime],
  );
  const toggle = useCallback(
    (path: string) => {
      const capturedScope = runtime.scope;
      runtime.accept(capturedScope, () =>
        runtime.store.setState((state) => toggleTreeFolder(state, path)),
      );
    },
    [runtime],
  );

  return { expanded, rows, select, selectedPath, toggle };
}
