import { useCallback, useRef, type MutableRefObject } from 'react';
import { api, type FolderState } from '../api';
import { folderRefsEqual, isAbsoluteFolderRef } from '../folderPath';
import { createFolderMutationQueue } from '../folderTransition';
import type { EditorHandle } from './actionTypes';
import type { Action, LibraryFolderStatus, State } from './state';
import type { ToastOptions } from './useFeedbackActions';

type Dispatch = (action: Action) => void;
type Toast = (message: string, opts?: ToastOptions) => string;

interface FolderActionRefs {
  state: MutableRefObject<State>;
  folderContextPath: MutableRefObject<string>;
  editor: MutableRefObject<EditorHandle | null>;
  openGeneration: MutableRefObject<number>;
  openingFolderGeneration: MutableRefObject<number | null>;
  syncGeneration: MutableRefObject<number>;
  searchGeneration: MutableRefObject<number>;
  lastTreeVersion: MutableRefObject<number>;
  importConversionGrace: MutableRefObject<Map<string, number>>;
  importIndexGrace: MutableRefObject<Map<string, number>>;
  keyBackfillGrace: MutableRefObject<Map<string, number>>;
}

interface FolderActionDependencies {
  flushSave: () => Promise<boolean>;
  loadFiles: (expectedFolderPath?: string) => Promise<State['files']>;
  loadFileOrder: (expectedFolderPath?: string) => Promise<void>;
  markVisibleFilesPendingForSearch: (files?: State['files']) => Promise<void>;
  refreshIndexState: (folderPath?: string) => Promise<void>;
  toast: Toast;
}

export async function runFolderOpenTransition({
  openGeneration,
  openingFolderGeneration,
  request,
  commitNavigation,
  afterNavigation,
}: {
  openGeneration: MutableRefObject<number>;
  openingFolderGeneration: MutableRefObject<number | null>;
  request: () => Promise<FolderState>;
  commitNavigation: (current: NonNullable<FolderState['current']>, generation: number) => void;
  afterNavigation: (
    current: NonNullable<FolderState['current']>,
    generation: number,
  ) => Promise<void>;
}): Promise<void> {
  const generation = ++openGeneration.current;
  openingFolderGeneration.current = generation;
  try {
    const opened = await request();
    if (!opened.current || generation !== openGeneration.current) return;
    commitNavigation(opened.current, generation);
    if (openingFolderGeneration.current === generation) {
      openingFolderGeneration.current = null;
    }
    await afterNavigation(opened.current, generation);
  } finally {
    if (openingFolderGeneration.current === generation) {
      openingFolderGeneration.current = null;
    }
  }
}

export function commitOpenedFolderNavigation(
  dispatch: Dispatch,
  folderContextPath: MutableRefObject<string>,
  expected: NonNullable<FolderState['current']>,
) {
  folderContextPath.current = expected.path;
  dispatch({
    type: 'FILES_LOADED',
    files: [],
    folders: [],
    folder: expected.name,
    folderPath: expected.path,
  });
}

function libraryStatusFromActiveFolder(state: State): LibraryFolderStatus {
  const hasPreparationFailure = state.preparationFailures.some((problem) => problem.status !== 'cancelled');
  if (state.indexWarning || hasPreparationFailure || state.blockedConversions.length > 0) return 'failed';
  const semanticPending = state.embedderHasKey !== false && state.pendingSemanticNames.size > 0;
  if (state.syncRunning || semanticPending || state.pendingConversions.length > 0) return 'preparing';
  return 'ready';
}

/** Owns folder-session transitions and invalidates stale async finishers. */
export function useFolderActions(
  refs: FolderActionRefs,
  dependencies: FolderActionDependencies,
  dispatch: Dispatch,
) {
  const {
    editor,
    folderContextPath,
    importConversionGrace,
    importIndexGrace,
    keyBackfillGrace,
    lastTreeVersion,
    openGeneration,
    openingFolderGeneration,
    searchGeneration,
    state,
    syncGeneration,
  } = refs;
  const {
    flushSave,
    loadFileOrder,
    loadFiles,
    markVisibleFilesPendingForSearch,
    refreshIndexState,
    toast,
  } = dependencies;
  const folderMutations = useRef(createFolderMutationQueue()).current;

  const resetFolderScopedState = useCallback(() => {
    const previous = state.current;
    if (previous.folderPath) {
      dispatch({
        type: 'LIBRARY_FOLDER_STATUS',
        path: previous.folderPath,
        status: libraryStatusFromActiveFolder(previous),
      });
    }
    syncGeneration.current += 1;
    searchGeneration.current += 1;
    lastTreeVersion.current = -1;
    importConversionGrace.current.clear();
    importIndexGrace.current.clear();
    keyBackfillGrace.current.clear();
    folderContextPath.current = '';
    dispatch({ type: 'TABS_RESET' });
    dispatch({ type: 'CHAT_TABS_RESET' });
    dispatch({ type: 'SIDEBAR_VIEW', view: 'files' });
    dispatch({ type: 'FILTER', q: '' });
    dispatch({ type: 'SEARCH_CLEAR' });
    dispatch({ type: 'ACTIVE_FOLDER', path: '' });
    dispatch({ type: 'PENDING_SEMANTIC_NAMES', names: new Set() });
    dispatch({ type: 'PENDING_CONVERSIONS', paths: [] });
    dispatch({ type: 'BLOCKED_CONVERSIONS', paths: [] });
    dispatch({ type: 'CONVERSION_PROGRESS', progress: {} });
    dispatch({ type: 'CONVERSION_SCHEDULER_STATE', revision: 0, versions: {} });
    dispatch({ type: 'INDEX_WARNING', warning: null });
    dispatch({ type: 'PREPARATION_FAILURES', failures: [] });
    dispatch({ type: 'SYNC_RUNNING', running: false });
    dispatch({ type: 'FILE_ORDER_LOADED', order: {} });
  }, [
    dispatch,
    folderContextPath,
    importConversionGrace,
    importIndexGrace,
    keyBackfillGrace,
    lastTreeVersion,
    searchGeneration,
    state,
    syncGeneration,
  ]);

  const commitFolderOpenNavigation = useCallback((
    expected: { path: string; name: string },
    generation: number,
  ) => {
    if (generation !== openGeneration.current) return false;
    resetFolderScopedState();
    dispatch({ type: 'COLLAPSE_ALL_FOLDERS' });
    commitOpenedFolderNavigation(dispatch, folderContextPath, expected);
    return true;
  }, [
    dispatch,
    folderContextPath,
    openGeneration,
    resetFolderScopedState,
  ]);

  const finishOpenFolderBackground = useCallback(async (
    expected: { path: string; name: string },
    generation: number,
    opts: { optimisticPendingOnOpen?: boolean } = {},
  ) => {
    const expectedFolderPath = expected.path;
    const [files] = await Promise.all([
      loadFiles(expectedFolderPath),
      loadFileOrder(expectedFolderPath),
    ]);
    if (
      generation !== openGeneration.current
      || state.current.folderPath !== expectedFolderPath
    ) return;
    if (opts.optimisticPendingOnOpen && state.current.embedderHasKey !== false) {
      await markVisibleFilesPendingForSearch(files);
    }
    setTimeout(() => {
      if (
        generation !== openGeneration.current
        || state.current.folderPath !== expectedFolderPath
      ) return;
      void refreshIndexState(expectedFolderPath);
    }, 500);
  }, [
    loadFileOrder,
    loadFiles,
    markVisibleFilesPendingForSearch,
    openGeneration,
    refreshIndexState,
    state,
  ]);

  const finishOpenFolder = useCallback(async (
    expected: { path: string; name: string },
    generation: number,
    opts: { optimisticPendingOnOpen?: boolean } = {},
  ) => {
    if (!commitFolderOpenNavigation(expected, generation)) return;
    await finishOpenFolderBackground(expected, generation, opts);
  }, [commitFolderOpenNavigation, finishOpenFolderBackground]);

  const refreshRecent = useCallback(async () => {
    const result = await api.getFolder();
    dispatch({ type: 'RECENT_LOADED', recent: result.recent ?? [], homeDir: result.homeDir });
  }, [dispatch]);

  const performFolderOpen = useCallback(async (
    request: () => Promise<FolderState>,
    opts: { optimisticPendingOnOpen?: boolean } = {},
  ) => {
    await runFolderOpenTransition({
      openGeneration,
      openingFolderGeneration,
      request,
      commitNavigation: (current, generation) => {
        void refreshRecent().catch((err) => {
          console.warn('[recent] refresh after open failed:', err);
        });
        commitFolderOpenNavigation(current, generation);
      },
      afterNavigation: (current, generation) =>
        finishOpenFolderBackground(current, generation, opts),
    });
  }, [
    commitFolderOpenNavigation,
    finishOpenFolderBackground,
    openGeneration,
    openingFolderGeneration,
    refreshRecent,
  ]);

  const openFolder = useCallback(async (path: string) => {
    if (editor.current && !(await flushSave())) {
      throw new Error('Current file could not be saved. Resolve the save error before switching folders.');
    }
    await performFolderOpen(() => folderMutations.run(() => api.openFolder(path)));
  }, [editor, flushSave, folderMutations, performFolderOpen]);

  const openFolderByName = useCallback(async (
    name: string,
    opts?: { create?: boolean; exclusiveCreate?: boolean; optimisticPendingOnOpen?: boolean },
  ) => {
    if (editor.current && !(await flushSave())) {
      throw new Error('Current file could not be saved. Resolve the save error before switching folders.');
    }
    await performFolderOpen(() => folderMutations.run(() => api.openFolderByName(name, {
      create: opts?.create,
      exclusiveCreate: opts?.exclusiveCreate,
    })), {
      optimisticPendingOnOpen: opts?.optimisticPendingOnOpen,
    });
  }, [editor, flushSave, folderMutations, performFolderOpen]);

  const prepareForFolderRemoval = useCallback((removedPath: string) => {
    if (!state.current.folderPath || !folderRefsEqual(state.current.folderPath, removedPath)) return;
    openGeneration.current += 1;
    resetFolderScopedState();
    dispatch({ type: 'FILES_LOADED', files: [], folders: [], folder: '', folderPath: '' });
    dispatch({
      type: 'RECENT_LOADED',
      recent: state.current.recent.filter((entry) => !folderRefsEqual(entry.path, removedPath)),
      homeDir: state.current.homeDir,
    });
  }, [dispatch, openGeneration, resetFolderScopedState, state]);

  const handleFolderRemoved = useCallback((removedPath: string) => {
    const affected = Boolean(
      state.current.folderPath
      && folderRefsEqual(state.current.folderPath, removedPath),
    );
    if (affected) prepareForFolderRemoval(removedPath);
    // Every window's sidebar shows the library list, so all of them
    // refresh membership after a removal — not just the affected one.
    void api.getFolder().then((result) => dispatch({
      type: 'RECENT_LOADED',
      recent: result.recent ?? [],
      homeDir: result.homeDir,
    }))
    .catch(() => { /* Keep the optimistic membership removal. */ });
  }, [dispatch, prepareForFolderRemoval, state]);

  const bootstrap = useCallback(async () => {
    try {
      const result = await api.getFolder();
      dispatch({ type: 'RECENT_LOADED', recent: result.recent ?? [], homeDir: result.homeDir });
      const initialFolder = new URLSearchParams(window.location.search).get('folder');
      if (initialFolder) {
        window.history.replaceState(null, '', window.location.pathname);
        try {
          if (isAbsoluteFolderRef(initialFolder)) {
            await openFolder(initialFolder);
          } else {
            await openFolderByName(initialFolder);
          }
        } catch (err: unknown) {
          // Stay on the no-folder workspace: the user asked for a
          // specific folder, so don't silently substitute another one.
          toast(
            `Could not open "${initialFolder}": ${err instanceof Error ? err.message : String(err)}`,
            { level: 'error' },
          );
        }
        return;
      }
      if (result.current) {
        const generation = ++openGeneration.current;
        await finishOpenFolder(result.current, generation);
        const restoredFolderPath = result.current.path;
        if (
          generation === openGeneration.current
          && state.current.folderPath === restoredFolderPath
        ) {
          void api.sync(restoredFolderPath)
            .catch(() => { /* Surfaced by the next status poll. */ })
            .finally(() => { void refreshIndexState(); });
        }
        return;
      }
      // No window-bound folder: boot straight into the most recent
      // library folder. An empty library stays on the zero-folder
      // workspace (the sidebar carries the add-folder affordance).
      const mostRecent = result.recent?.[0]?.path;
      if (mostRecent) {
        try {
          await openFolder(mostRecent);
        } catch (err: unknown) {
          toast(
            `Could not open "${mostRecent}": ${err instanceof Error ? err.message : String(err)}`,
            { level: 'error' },
          );
        }
      }
    } catch {
      toast('Server unreachable', { level: 'error' });
    } finally {
      dispatch({ type: 'BOOTED' });
    }
  }, [
    dispatch,
    finishOpenFolder,
    openFolder,
    openFolderByName,
    openGeneration,
    refreshIndexState,
    state,
    toast,
  ]);

  return {
    bootstrap,
    handleFolderRemoved,
    openFolder,
    openFolderByName,
    prepareForFolderRemoval,
  };
}
