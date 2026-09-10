/**
 * Where this window lands, and the saved presentation state it lands with.
 *
 * The rule for which folder wins is not here: it is
 * `domain/landing.ts`, one total function over the three sources that can name
 * one. This hook owns the mechanics of carrying that answer out — asking the
 * desktop once, holding one open request in flight, publishing the snapshot
 * the request answers with, and reporting whether the window has settled.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';

import { openFolder } from '@/features/workspace/application/open-folder';
import type {
  LibraryLifecyclePort,
  LibraryPort,
  WorkspaceSessionPort,
} from '@/features/workspace/application/ports';
import { libraryQuery, workspaceQueryKeys } from '@/features/workspace/application/queries';
import {
  createWorkspaceSessionRuntime,
  type WorkspaceSessionRuntime,
} from '@/features/workspace/application/session-runtime';
import {
  chooseFolderLanding,
  landingToOpen,
  type InitialFolderClaim,
} from '@/features/workspace/domain/landing';
import { restoreFolderSession, type FolderSessionState } from '@/features/workspace/domain/session';
import { useRequestSignals } from '@/shared/runtime/use-request-signals';
import { useRetainedRuntime } from '@/shared/runtime/use-retained-runtime';

/**
 * Where landing stands, as one value.
 *
 * The three parallel flags this replaced could spell states restoration never
 * reaches — ready while still restoring, a restored folder before the stored
 * session had even been read. Only `ready` carries the folder to restore,
 * because only `ready` has one. `restoring` covers three waits: the stored
 * session being read, the desktop being asked which folder this window was
 * created for, and the winning folder being opened.
 */
type WorkspaceSessionStatus =
  | { kind: 'restoring' }
  | { kind: 'ready'; restoredFolder: FolderSessionState | null };

export interface WorkspaceSessionController {
  runtime: WorkspaceSessionRuntime;
  status: WorkspaceSessionStatus;
  shell: {
    agentPaneWidth: number;
    sidebarOpen: boolean;
    sidebarWidth: number;
  };
}

export function useWorkspaceSession(
  api: LibraryPort,
  persistence: WorkspaceSessionPort,
  lifecycle: Pick<LibraryLifecyclePort, 'claimInitialFolder'>,
): WorkspaceSessionController {
  const queryClient = useQueryClient();
  const runtime = useRetainedRuntime(
    () => createWorkspaceSessionRuntime(persistence),
    (session) => session.dispose(),
  );
  const state = useStore(runtime.store);
  const library = useQuery(libraryQuery(api)).data;
  const attemptedRestore = useRef<string | null>(null);
  // One lane: reopening a different folder replaces the attempt in flight.
  const signalFor = useRequestSignals<'restore-folder'>();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [initialFolder, setInitialFolder] = useState<InitialFolderClaim>({ kind: 'pending' });

  useEffect(() => {
    void runtime.restore();
  }, [runtime]);

  // Asked while there is no answer, rather than once per port identity: a
  // window claims its folder exactly once, so keying this to the port would
  // both re-ask a caller that rebuilds it and say something untrue about when
  // a second claim is wanted. The port is idempotent, so a re-run and
  // StrictMode's second mount both read the first answer.
  useEffect(() => {
    if (initialFolder.kind === 'settled') return;
    let live = true;
    const settle = (folderPath: string | null) => {
      if (live) setInitialFolder({ kind: 'settled', folderPath });
    };
    // The claim settles either way. A window that could not ask is a window
    // with no folder named for it, and it lands by saved session instead;
    // leaving the claim pending would strand the window in its restoring state
    // with no render left to correct it.
    void lifecycle.claimInitialFolder().then(settle, () => settle(null));
    return () => {
      live = false;
    };
  }, [initialFolder.kind, lifecycle]);

  const memberPaths = useMemo(
    () => library?.members.map((member) => member.path) ?? [],
    [library?.members],
  );
  const restorablePath =
    state.restoreStatus === 'ready' &&
    state.snapshot.activeFolderPath &&
    memberPaths.includes(state.snapshot.activeFolderPath)
      ? state.snapshot.activeFolderPath
      : null;

  const landing = useMemo(
    () =>
      chooseFolderLanding({
        activeFolder: library?.activeFolder?.path ?? null,
        initialFolder,
        sessionFolder: restorablePath,
      }),
    [initialFolder, library?.activeFolder?.path, restorablePath],
  );
  // A landing that still owes an open request, for the status below.
  const unopened = landingToOpen(landing);

  useEffect(() => {
    if (!library || state.restoreStatus !== 'ready') return;
    runtime.reconcileMembership(memberPaths);

    // Still asking the desktop which folder this window was made for. Opening
    // anything now is how the saved session used to win that race.
    if (landing.source === 'pending') return;

    if (landing.source === 'server') {
      attemptedRestore.current = landing.path;
      runtime.setActiveFolder(landing.path);
      return;
    }

    if (landing.source === 'none') {
      runtime.setActiveFolder(null);
      return;
    }

    // Whichever source won, it is opened exactly the way a reader's own click
    // would open it, so the server learns this window's folder the one way.
    const wanted = landing.path;
    if (attemptedRestore.current === wanted) return;
    attemptedRestore.current = wanted;
    const capturedLibrary = library;
    setPendingPath(wanted);
    void openFolder(api, wanted, signalFor('restore-folder')).then((result) => {
      if (
        result.status === 'opened' &&
        queryClient.getQueryData(workspaceQueryKeys.library) === capturedLibrary
      ) {
        queryClient.setQueryData(workspaceQueryKeys.library, result.snapshot);
      } else if (result.status === 'failed') {
        runtime.setActiveFolder(null);
      }
      setPendingPath((current) => (current === wanted ? null : current));
    });
    return () => setPendingPath((current) => (current === wanted ? null : current));
  }, [api, landing, library, memberPaths, queryClient, runtime, signalFor, state.restoreStatus]);

  // Read off the same landing the effect acts on, so the two can never
  // disagree. A folder the library already has open is not being restored,
  // whatever else still names one: the attempt marker is a ref, so a window
  // that never has to open anything would otherwise stay "restoring" with no
  // render left to correct it. A window created for a folder counts as
  // restoring from the first render, which is what keeps the welcome screen
  // from flashing before its folder arrives.
  const restoring =
    state.restoreStatus === 'loading' ||
    landing.source === 'pending' ||
    pendingPath !== null ||
    (unopened !== null && attemptedRestore.current !== unopened);

  return {
    runtime,
    shell: state.snapshot.shell,
    status: restoring
      ? { kind: 'restoring' }
      : {
          kind: 'ready',
          restoredFolder: library?.activeFolder
            ? restoreFolderSession(state.snapshot, library.activeFolder.path)
            : null,
        },
  };
}
