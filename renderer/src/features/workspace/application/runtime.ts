import { createStore, type StoreApi } from 'zustand/vanilla';

import type { WorkspaceQueryScope } from '@/features/workspace/application/ports';
import type { ActiveLibraryFolder } from '@/features/workspace/domain/library';
import type { FolderSessionState } from '@/features/workspace/domain/session';
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
  retire(): void;
}

export interface WorkspaceRuntimeOptions {
  folder: ActiveLibraryFolder;
  generation: number;
  queries: WorkspaceQueryScope;
  restored?: FolderSessionState | null;
}

export function createWorkspaceRuntime({
  folder,
  generation,
  queries,
  restored = null,
}: WorkspaceRuntimeOptions): WorkspaceRuntime {
  if (!Number.isSafeInteger(generation) || generation < 1) {
    throw new Error('Workspace runtime generation must be a positive safe integer.');
  }
  const scope: WorkspaceScope = Object.freeze({
    folder: Object.freeze({ ...folder }),
    generation,
  });
  const controller = new AbortController();
  const store = createStore<WorkspaceState>(() => createWorkspaceState(scope, restored));
  let disposed = false;
  let queriesRemoved = false;

  const finish = (removeQueries: boolean) => {
    if (!disposed) {
      disposed = true;
      controller.abort();
      store.setState(disposeWorkspaceState);
      void queries.cancel().catch(() => undefined);
    }
    if (removeQueries && !queriesRemoved) {
      queriesRemoved = true;
      queries.remove();
    }
  };

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
      finish(false);
    },
    retire() {
      finish(true);
    },
  };
}
