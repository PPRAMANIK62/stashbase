import { createStore, type StoreApi } from 'zustand/vanilla';

import type { WorkspaceQueryScope } from '@/features/workspace/application/ports';
import type { ActiveLibraryFolder } from '@/features/workspace/domain/library';
import {
  createWorkspaceState,
  disposeWorkspaceState,
  type WorkspaceScope,
  type WorkspaceState,
} from '@/features/workspace/domain/workspace';

export interface WorkspaceRuntime {
  readonly scope: WorkspaceScope;
  readonly signal: AbortSignal;
  readonly store: StoreApi<WorkspaceState>;
  accept(capturedScope: WorkspaceScope, completion: () => void): boolean;
  dispose(): void;
}

export interface WorkspaceRuntimeOptions {
  folder: ActiveLibraryFolder;
  generation: number;
  queries: WorkspaceQueryScope;
}

export function createWorkspaceRuntime({
  folder,
  generation,
  queries,
}: WorkspaceRuntimeOptions): WorkspaceRuntime {
  if (!Number.isSafeInteger(generation) || generation < 1) {
    throw new Error('Workspace runtime generation must be a positive safe integer.');
  }
  const scope: WorkspaceScope = Object.freeze({
    folder: Object.freeze({ ...folder }),
    generation,
  });
  const controller = new AbortController();
  const store = createStore<WorkspaceState>(() => createWorkspaceState(scope));
  let disposed = false;

  return {
    scope,
    signal: controller.signal,
    store,
    accept(capturedScope, completion) {
      if (
        disposed ||
        capturedScope.generation !== scope.generation ||
        capturedScope.folder.path !== scope.folder.path
      ) {
        return false;
      }
      completion();
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.abort();
      store.setState(disposeWorkspaceState);
      void queries.cancel().catch(() => undefined);
    },
  };
}
