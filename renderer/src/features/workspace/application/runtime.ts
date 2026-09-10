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
import { createScopeGuard, type CapturedScope } from '@/shared/runtime/scope-guard';

/** What one workspace operation was started under: the folder scope, and the
 *  generation of operations live at the time. */
export type WorkspaceOperationScope = CapturedScope<WorkspaceScope>;

export interface WorkspaceRuntime {
  readonly scope: WorkspaceScope;
  readonly signal: AbortSignal;
  readonly store: StoreApi<WorkspaceState>;
  /** Runs `completion` only when the operation `captured` was started under is
   *  still the live one: same folder scope, no newer retirement, and a runtime
   *  that has not been disposed. Answers whether it ran, so a caller can drop
   *  the rest of a stale completion too. */
  accept(captured: WorkspaceOperationScope, completion: () => void): boolean;
  /** The token an operation is started under. Take it before the operation's
   *  first `await` and hand it back to `accept` afterwards: capturing at
   *  completion time would compare the live scope with itself and guard
   *  nothing. */
  capture(): WorkspaceOperationScope;
  dispose(): void;
  retire(): void;
  /** Retires every operation in flight, so their completions are refused. The
   *  folder itself stays open: rebinding it re-reads the tree from scratch, and
   *  a completion aimed at the tree before that is no longer about this one. */
  retireOperations(): void;
  /** The folder's presentation state as of now, for the saved session. */
  toSession(): WorkspaceState;
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
  const guard = createScopeGuard<WorkspaceScope>({
    disposed: () => disposed,
    sameScope: (captured, live) =>
      captured.generation === live.generation && captured.folder.path === live.folder.path,
    scope: () => scope,
  });

  const finish = (removeQueries: boolean) => {
    if (!disposed) {
      disposed = true;
      guard.retireOperations();
      controller.abort();
      store.setState(disposeWorkspaceState);
      // Cancelling in-flight reads is best effort during teardown.
      // swallowed: the folder is already gone, so a rejected cancellation has no reader.
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
    accept: guard.accept,
    capture: guard.capture,
    dispose() {
      finish(false);
    },
    retire() {
      finish(true);
    },
    retireOperations: guard.retireOperations,
    toSession() {
      return store.getState();
    },
  };
}
