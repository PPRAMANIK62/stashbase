/**
 * Create, rename, and delete for the active folder's tree.
 *
 * Every mutation captures the workspace scope before its first await and
 * settles through that token: a create that lands after the window moved to
 * another folder updates nothing, refetches nothing, and asks for no focus.
 *
 * Cancellation is one lane per subject: two entries may be created, renamed or
 * deleted at once and neither cancels the other, while a repeated command on
 * the same entry replaces its own in-flight call. Leaving the folder unmounts
 * the tree and aborts every lane, and the captured scope refuses any
 * completion that still arrives.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { filesFailure } from '@/features/workspace/application/failure-messages';
import type { FilesPort } from '@/features/workspace/application/ports';
import { refreshFolderListing } from '@/features/workspace/application/queries';
import type {
  WorkspaceOperationScope,
  WorkspaceRuntime,
} from '@/features/workspace/application/runtime';
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
import type { FailureView } from '@/shared/domain/feature-error';
import type { SourceReference } from '@/shared/domain/source-reference';
import { useRequestSignals } from '@/shared/runtime/use-request-signals';

/** One lane per command and per entry path. */
type FileOperationLane = `${'create' | 'delete' | 'rename'}:${string}`;

/** The one naming task the tree can hold open: a new entry waiting for its
 *  name under a parent, or an existing entry taking a new one. */
export type FileTreeNaming =
  | { kind: 'create'; entryKind: WorkspaceEntry['kind']; parentPath: string }
  | { entry: WorkspaceEntry; kind: 'rename' };

export interface FileOperationsOptions {
  onOpenSource?: ((source: SourceReference) => void) | undefined;
  /** Settles the open documents under an entry before it leaves its path:
   *  saves and closes them and returns their sources, or null when a save
   *  failed and the entry must stay where it is. */
  retireSources?: ((entry: WorkspaceEntry) => Promise<SourceReference[] | null>) | undefined;
}

/** A document the reader has open refused to save, which is theirs to fix. */
const RETIRE_BLOCKED: FailureView = {
  message: 'An open document could not be saved, so nothing was changed.',
  tone: 'input',
};

function leafName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function movedPath(path: string, from: string, to: string): string {
  return `${to}${path.slice(from.length)}`;
}

/** Naming happens inline, deletion waits for confirmation, and every settled
 *  mutation moves expansion and selection with the entry before the listing
 *  refetches, so the tree never shows a stale open folder or a selection that
 *  left. */
export function useFileOperations(
  runtime: WorkspaceRuntime,
  api: FilesPort,
  options: FileOperationsOptions = {},
) {
  const queryClient = useQueryClient();
  const latest = useRef(options);
  latest.current = options;
  const signalFor = useRequestSignals<FileOperationLane>();
  const [naming, setNaming] = useState<FileTreeNaming | null>(null);
  const [deleting, setDeleting] = useState<WorkspaceEntry | null>(null);
  const [failure, setFailure] = useState<FailureView | null>(null);
  const [pending, setPending] = useState(false);
  /** The path whose row should take focus once the listing shows it. */
  const [settledPath, setSettledPath] = useState<string | null>(null);

  const folderPath = runtime.scope.folder.path;
  /** Applies a state change only while `capturedScope` is still the open one. */
  const update = useCallback(
    (
      captured: WorkspaceOperationScope,
      change: (state: WorkspaceState) => WorkspaceState,
    ): boolean => runtime.accept(captured, () => runtime.store.setState(change)),
    [runtime],
  );
  /** True while the scope an operation started in is still the open one. */
  const stillOpen = useCallback(
    (captured: WorkspaceOperationScope): boolean => runtime.accept(captured, () => undefined),
    [runtime],
  );
  const refresh = useCallback(
    () => refreshFolderListing(queryClient, folderPath),
    [folderPath, queryClient],
  );
  const openSource = useCallback(
    (path: string) => latest.current.onOpenSource?.({ folderPath, path }),
    [folderPath],
  );

  /** Runs one mutation, keeping a failure on screen and answering null. The
   *  sentence comes from the failure's kind; a throw that is not a files
   *  failure reads as the unavailable one. */
  const run = useCallback(
    async <Result>(
      lane: FileOperationLane,
      operation: (signal: AbortSignal) => Promise<Result>,
    ): Promise<Result | null> => {
      const signal = signalFor(lane);
      setPending(true);
      setFailure(null);
      try {
        return await operation(signal);
      } catch (error) {
        if (!signal.aborted) {
          setFailure(filesFailure(error));
        }
        return null;
      } finally {
        if (!signal.aborted) setPending(false);
      }
    },
    [signalFor],
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
      if (parentPath) update(runtime.capture(), (state) => expandTreeFolder(state, parentPath));
      setFailure(null);
      setNaming({ entryKind, kind: 'create', parentPath });
    },
    [runtime, update],
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
        // A name the reader typed is theirs to correct.
        setFailure({ message: problem, tone: 'input' });
        return;
      }
      const capturedScope = runtime.capture();
      setNaming(null);
      if (naming.kind === 'create') {
        const created = await run(`create:${naming.parentPath}/${name}`, (signal) =>
          api.createEntry(folderPath, naming.entryKind, naming.parentPath, name, signal),
        );
        if (!stillOpen(capturedScope)) return;
        if (!created) {
          setSettledPath(naming.parentPath || null);
          return;
        }
        update(capturedScope, (state) => {
          const selected = selectTreePath(state, created.path);
          return naming.entryKind === 'folder'
            ? expandTreeFolder(selected, created.path)
            : selected;
        });
        await refresh();
        if (!stillOpen(capturedScope)) return;
        setSettledPath(created.path);
        if (naming.entryKind === 'file') openSource(created.path);
        return;
      }
      const { entry } = naming;
      const retired = await retire(entry);
      if (!stillOpen(capturedScope)) return;
      if (retired === null) {
        setSettledPath(entry.path);
        return;
      }
      const renamed = await run(`rename:${entry.path}`, (signal) =>
        api.renameEntry(folderPath, entry, name, signal),
      );
      if (!stillOpen(capturedScope)) return;
      if (!renamed) {
        setSettledPath(entry.path);
        for (const source of retired) openSource(source.path);
        return;
      }
      update(capturedScope, (state) => renameTreePath(state, entry.path, leafName(renamed.path)));
      await refresh();
      if (!stillOpen(capturedScope)) return;
      setSettledPath(renamed.path);
      for (const source of retired) openSource(movedPath(source.path, entry.path, renamed.path));
    },
    [
      api,
      cancelNaming,
      folderPath,
      naming,
      openSource,
      refresh,
      retire,
      run,
      runtime,
      stillOpen,
      update,
    ],
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
    const capturedScope = runtime.capture();
    const retired = await retire(entry);
    if (retired === null || !stillOpen(capturedScope)) return;
    const deleted = await run(`delete:${entry.path}`, async (signal) => {
      await api.deleteEntry(folderPath, entry, signal);
      return true;
    });
    if (!stillOpen(capturedScope)) return;
    if (!deleted) {
      for (const source of retired) openSource(source.path);
      return;
    }
    setDeleting(null);
    update(capturedScope, (state) => forgetTreePath(state, entry.path));
    await refresh();
    if (!stillOpen(capturedScope)) return;
    setSettledPath(parentTreePath(entry.path) || null);
  }, [api, deleting, folderPath, openSource, refresh, retire, run, runtime, stillOpen, update]);

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
