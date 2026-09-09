import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { FilesError, type FilesApi } from '@/features/workspace/application/ports';
import { workspaceQueryKeys } from '@/features/workspace/application/queries';
import type { WorkspaceRuntime } from '@/features/workspace/application/runtime';
import {
  entryNameProblem,
  parentTreePath,
  type WorkspaceEntry,
} from '@/features/workspace/domain/tree';
import {
  expandTreeFolder,
  forgetTreePath,
  renameTreePath,
  selectTreePath,
  type WorkspaceState,
} from '@/features/workspace/domain/workspace';
import type { SourceReference } from '@/shared/domain/source-reference';

/** The one naming task the tree can hold open: a new entry waiting for its
 *  name under a parent, or an existing entry taking a new one. */
export type FileTreeNaming =
  | { kind: 'create'; entryKind: WorkspaceEntry['kind']; parentPath: string }
  | { entry: WorkspaceEntry; kind: 'rename' };

export interface FileOperationsOptions {
  onOpenSource?: (source: SourceReference) => void;
  /** Settles the open documents under an entry before it leaves its path:
   *  saves and closes them and returns their sources, or null when a save
   *  failed and the entry must stay where it is. */
  retireSources?: (entry: WorkspaceEntry) => Promise<SourceReference[] | null>;
}

const RETIRE_BLOCKED = 'An open document could not be saved, so nothing was changed.';

function leafName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function movedPath(path: string, from: string, to: string): string {
  return `${to}${path.slice(from.length)}`;
}

/**
 * Create, rename, and delete for the active folder's tree. Naming happens
 * inline, deletion waits for confirmation, and every settled mutation moves
 * expansion and selection with the entry before the listing refetches, so
 * the tree never shows a stale open folder or a selection that left.
 */
export function useFileOperations(
  runtime: WorkspaceRuntime,
  api: FilesApi,
  options: FileOperationsOptions = {},
) {
  const queryClient = useQueryClient();
  const latest = useRef(options);
  latest.current = options;
  const controllers = useRef(new Set<AbortController>());
  const [naming, setNaming] = useState<FileTreeNaming | null>(null);
  const [deleting, setDeleting] = useState<WorkspaceEntry | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  /** The path whose row should take focus once the listing shows it. */
  const [settledPath, setSettledPath] = useState<string | null>(null);

  useEffect(() => {
    const abortAll = () => {
      for (const controller of controllers.current) controller.abort();
      controllers.current.clear();
    };
    runtime.signal.addEventListener('abort', abortAll);
    return () => {
      runtime.signal.removeEventListener('abort', abortAll);
      abortAll();
    };
  }, [runtime]);

  const folderPath = runtime.scope.folder.path;
  const update = useCallback(
    (change: (state: WorkspaceState) => WorkspaceState) => {
      const scope = runtime.scope;
      runtime.accept(scope, () => runtime.store.setState(change));
    },
    [runtime],
  );
  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.files(folderPath) }),
    [folderPath, queryClient],
  );
  const openSource = useCallback(
    (path: string) => latest.current.onOpenSource?.({ folderPath, path }),
    [folderPath],
  );

  /** Runs one mutation, keeping a failure on screen and answering null. */
  const run = useCallback(
    async <Result>(
      operation: (signal: AbortSignal) => Promise<Result>,
      fallback: string,
    ): Promise<Result | null> => {
      const controller = new AbortController();
      controllers.current.add(controller);
      setPending(true);
      setFailure(null);
      try {
        return await operation(controller.signal);
      } catch (error) {
        if (!controller.signal.aborted) {
          setFailure(error instanceof FilesError ? error.message : fallback);
        }
        return null;
      } finally {
        controllers.current.delete(controller);
        setPending(false);
      }
    },
    [],
  );

  const retire = useCallback(async (entry: WorkspaceEntry): Promise<SourceReference[] | null> => {
    const handler = latest.current.retireSources;
    if (!handler) return [];
    const retired = await handler(entry);
    if (retired === null) setFailure(RETIRE_BLOCKED);
    return retired;
  }, []);

  const cancelNaming = useCallback(() => {
    setNaming(null);
    setFailure(null);
  }, []);

  const beginCreate = useCallback(
    (entryKind: WorkspaceEntry['kind'], parentPath: string) => {
      if (parentPath) update((state) => expandTreeFolder(state, parentPath));
      setFailure(null);
      setNaming({ entryKind, kind: 'create', parentPath });
    },
    [update],
  );

  const beginRename = useCallback((entry: WorkspaceEntry) => {
    setFailure(null);
    setNaming({ entry, kind: 'rename' });
  }, []);

  const commitNaming = useCallback(
    async (rawName: string): Promise<void> => {
      if (!naming) return;
      const name = rawName.trim();
      if (naming.kind === 'rename' && (name === '' || name === leafName(naming.entry.path))) {
        cancelNaming();
        return;
      }
      const problem = entryNameProblem(name);
      if (problem) {
        setFailure(problem);
        return;
      }
      setNaming(null);
      if (naming.kind === 'create') {
        const created = await run(
          (signal) =>
            api.createEntry(folderPath, naming.entryKind, naming.parentPath, name, signal),
          `The ${naming.entryKind} could not be created.`,
        );
        if (!created) {
          setSettledPath(naming.parentPath || null);
          return;
        }
        update((state) => {
          const selected = selectTreePath(state, created.path);
          return naming.entryKind === 'folder'
            ? expandTreeFolder(selected, created.path)
            : selected;
        });
        await refresh();
        setSettledPath(created.path);
        if (naming.entryKind === 'file') openSource(created.path);
        return;
      }
      const { entry } = naming;
      const retired = await retire(entry);
      if (retired === null) {
        setSettledPath(entry.path);
        return;
      }
      const renamed = await run(
        (signal) => api.renameEntry(folderPath, entry, name, signal),
        `The ${entry.kind} could not be renamed.`,
      );
      if (!renamed) {
        setSettledPath(entry.path);
        for (const source of retired) openSource(source.path);
        return;
      }
      update((state) => renameTreePath(state, entry.path, leafName(renamed.path)));
      await refresh();
      setSettledPath(renamed.path);
      for (const source of retired) openSource(movedPath(source.path, entry.path, renamed.path));
    },
    [api, cancelNaming, folderPath, naming, openSource, refresh, retire, run, update],
  );

  const requestDelete = useCallback((entry: WorkspaceEntry) => {
    setFailure(null);
    setDeleting(entry);
  }, []);

  const cancelDelete = useCallback(() => {
    setDeleting(null);
    setFailure(null);
  }, []);

  const confirmDelete = useCallback(async (): Promise<void> => {
    if (!deleting) return;
    const entry = deleting;
    const retired = await retire(entry);
    if (retired === null) return;
    const deleted = await run(async (signal) => {
      await api.deleteEntry(folderPath, entry, signal);
      return true;
    }, `The ${entry.kind} could not be deleted.`);
    if (!deleted) {
      for (const source of retired) openSource(source.path);
      return;
    }
    setDeleting(null);
    update((state) => forgetTreePath(state, entry.path));
    await refresh();
    setSettledPath(parentTreePath(entry.path) || null);
  }, [api, deleting, folderPath, openSource, refresh, retire, run, update]);

  const consumeSettledPath = useCallback(() => setSettledPath(null), []);

  return {
    beginCreate,
    beginRename,
    cancelDelete,
    cancelNaming,
    commitNaming,
    confirmDelete,
    consumeSettledPath,
    deleting,
    failure,
    naming,
    pending,
    requestDelete,
    settledPath,
  };
}
