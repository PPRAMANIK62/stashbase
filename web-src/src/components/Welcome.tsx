import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  errorMessage,
  type IndexStatus,
} from '../api';
import { CubeLogoIcon, ExternalLinkIcon, FolderIcon, HistoryIcon, MoreHorizontalIcon, NewFolderIcon, StarIcon, TrashIcon } from '../icons';
import { useApp } from '../store/AppContext';
import type { LibraryFolderStatus } from '../store/state';
import { Menu, type MenuItem } from './Menu';
import { ModalShell } from './ModalShell';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { StatusMessage } from './ui/status';

interface ElectronBridge {
  openFolderDialog?: (opts?: {
    title?: string;
    buttonLabel?: string;
    defaultPath?: string;
    allowCreateDirectory?: boolean;
  }) => Promise<string | null>;
  openFolderWindow?: (folder: string) => Promise<boolean>;
  prepareFolderRemoval?: (folder: string) => Promise<boolean>;
  notifyFolderRemoved?: (folder: string) => Promise<boolean>;
}

interface FolderIndexSnapshot {
  state: LibraryFolderStatus;
  total: number;
  pending: number;
  converting: number;
}

const WELCOME_RECONCILE_COOLDOWN_MS = 30_000;
const OPEN_FOLDER_WATCHDOG_MS = 20_000;

/** Shorten an absolute path for display: `/Users/foo/Notes` → `~/Notes`
 *  when it lives under the user's home dir. Falls through unchanged
 *  otherwise (e.g. `/tmp/scratch`). */
function prettifyHome(abs: string, home: string): string {
  if (!home) return abs;
  if (abs === home) return '~';
  if (abs.startsWith(home + '/')) return '~/' + abs.slice(home.length + 1);
  return abs;
}

function basenameOfPath(path: string): string {
  const segs = path.split('/').filter(Boolean);
  return segs.pop() || path;
}

/** Notion-style relative "last opened" label: recency in coarse steps,
 *  falling back to a short date (with year only when it differs). */
function formatOpenedAt(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const now = new Date();
  const minutes = Math.floor((now.getTime() - t) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const d = new Date(t);
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return 'Today';
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

function folderIndexSnapshot(status: IndexStatus): FolderIndexSnapshot {
  const hasError = status.indexWarning
    || (status.preparationFailures?.some((problem) => problem.status !== 'cancelled') ?? false);
  const pending = status.pendingCount ?? 0;
  const converting = status.pendingConversions?.length ?? 0;
  const total = Math.max(0, status.total ?? 0);
  const indexReady = status.indexReady !== false;
  const isIndexing = !indexReady
    || status.visibleIndexingSettled === false
    || pending > 0
    || converting > 0;

  return {
    state: hasError ? 'failed' : isIndexing ? 'preparing' : 'ready',
    total,
    pending,
    converting,
  };
}

/**
 * Landing overlay shown when no folder is open (or after the user
 * explicitly goes home). The library is global; opening a folder only
 * changes the current view into one member folder.
 *
 *   - **New folder**: native picker opened at `~/Documents/StashBase`,
 *     with the OS "New Folder" affordance available.
 *   - **Open folder**: native picker to open any folder on disk in place.
 *   - **Library folders**: the member list (recents) — click to reopen.
 */
export function Welcome() {
  const { state, actions, dispatch } = useApp();
  const [folderHome, setFolderHome] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [folderMenu, setFolderMenu] = useState<{ path: string; name: string; rect: DOMRect } | null>(null);
  const [folderIndexSnapshots, setFolderIndexSnapshots] = useState<Record<string, FolderIndexSnapshot>>({});
  const [openingFolder, setOpeningFolder] = useState<{ path: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [tagFilter, setTagFilter] = useState<'recents' | 'favorites'>('recents');
  // Optimistic star toggle: flip in the store immediately, persist in the
  // background, and re-sync from the server if the write fails.
  const toggleFavorite = useCallback((path: string) => {
    setFolderMenu(null);
    const entry = state.recent.find((r) => r.path === path);
    if (!entry) return;
    const favorite = !entry.favorite;
    dispatch({
      type: 'WELCOME_SHOW',
      recent: state.recent.map((r) => (r.path === path ? { ...r, favorite } : r)),
      homeDir: state.homeDir,
    });
    void api.setFolderFavorite(path, favorite).catch((e) => {
      void api.getFolder()
        .then((j) => dispatch({ type: 'WELCOME_SHOW', recent: j.recent ?? [], homeDir: j.homeDir, error: errorMessage(e) }))
        .catch(() => dispatch({ type: 'WELCOME_ERROR', error: errorMessage(e) }));
    });
  }, [dispatch, state.homeDir, state.recent]);
  const welcomeReconcileStartedAt = useRef<Map<string, number>>(new Map());
  const openingRequestRef = useRef(0);

  const removeFolder = useCallback((path: string) => {
    setRemoving(true);
    void (async () => {
      const bridge = (window as { electron?: ElectronBridge }).electron;
      if (bridge?.prepareFolderRemoval) {
        const ready = await bridge.prepareFolderRemoval(path);
        if (!ready) {
          throw new Error('Another window could not save its current edit. The folder was not removed.');
        }
      }
      await api.removeFolder(path);
      await bridge?.notifyFolderRemoved?.(path);
      dispatch({ type: 'LIBRARY_FOLDER_STATUS_REMOVE', path });
      const j = await api.getFolder();
      dispatch({ type: 'WELCOME_SHOW', recent: j.recent ?? [], homeDir: j.homeDir });
    })()
      .catch((e) => dispatch({ type: 'WELCOME_ERROR', error: errorMessage(e) }))
      .finally(() => { setRemoving(false); setConfirmRemove(null); });
  }, [dispatch]);

  const refreshFolderHome = useCallback(async () => {
    const r = await api.getFolderHome();
    setFolderHome(r.path);
    return r.path;
  }, []);

  // Fetch folderHome so New Folder opens the native picker at the
  // default StashBase location.
  useEffect(() => {
    void (async () => {
      try {
        await refreshFolderHome();
      } catch (err) {
        dispatch({ type: 'WELCOME_ERROR', error: errorMessage(err) });
      }
    })();
  }, [dispatch, refreshFolderHome]);

  useEffect(() => {
    if (!state.welcomeVisible) return;
    let cancelled = false;
    void Promise.all([api.getFolder(), refreshFolderHome()])
      .then(([j]) => {
        if (cancelled) return;
        dispatch({ type: 'WELCOME_SHOW', recent: j.recent ?? [], homeDir: j.homeDir });
      })
      .catch(() => { /* keep the current welcome state */ });
    return () => { cancelled = true; };
  }, [dispatch, refreshFolderHome, state.welcomeVisible]);

  useEffect(() => {
    if (!state.welcomeVisible) setOpeningFolder(null);
  }, [state.welcomeVisible]);

  useEffect(() => {
    if (!openingFolder || !state.welcomeVisible) return undefined;
    const timer = setTimeout(() => {
      setOpeningFolder(null);
      dispatch({
        type: 'WELCOME_ERROR',
        error: `Opening ${openingFolder.name} is taking longer than expected. Please try again.`,
      });
    }, OPEN_FOLDER_WATCHDOG_MS);
    return () => clearTimeout(timer);
  }, [dispatch, openingFolder, state.welcomeVisible]);

  useEffect(() => {
    if (!state.welcomeVisible || openingFolder || state.recent.length === 0) {
      setFolderIndexSnapshots({});
      return;
    }
    let cancelled = false;
    const paths = state.recent.map((r) => r.path);
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function refreshFolderStates() {
      const entries = await Promise.all(paths.map(async (path) => {
        try {
          const status = await api.indexStatus(path);
          return [path, folderIndexSnapshot(status)] as const;
        } catch {
          return [path, {
            state: state.libraryFolderStatuses[path] ?? 'unknown',
            total: 0,
            pending: 0,
            converting: 0,
          }] as const;
        }
      }));
      if (cancelled) return;
      const fresh = Object.fromEntries(entries) as Record<string, FolderIndexSnapshot>;
      let nextForPolling = fresh;
      setFolderIndexSnapshots((prev) => {
        const merged = Object.fromEntries(Object.entries(fresh).map(([path, snapshot]) => {
          const previous = prev[path];
          return [path, { ...previous, ...snapshot }];
        })) as Record<string, FolderIndexSnapshot>;
        nextForPolling = merged;
        return merged;
      });
      const keepPolling = Object.values(nextForPolling).some((s) => s.state === 'preparing' || s.state === 'unknown');
      if (keepPolling) timer = setTimeout(refreshFolderStates, 1500);
    }
    timer = setTimeout(refreshFolderStates, 750);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [openingFolder, state.libraryFolderStatuses, state.recent, state.welcomeVisible]);

  useEffect(() => {
    if (!state.welcomeVisible || openingFolder || state.recent.length === 0) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      for (const folder of state.recent) {
        const lastStarted = welcomeReconcileStartedAt.current.get(folder.path) ?? 0;
        if (now - lastStarted < WELCOME_RECONCILE_COOLDOWN_MS) continue;
        welcomeReconcileStartedAt.current.set(folder.path, now);
        void api.sync(folder.path)
          .catch((err) => {
            console.warn(`[welcome] reconcile failed for ${folder.path}:`, err);
          });
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [openingFolder, state.recent, state.welcomeVisible]);

  function openRecent(path: string) {
    const requestId = ++openingRequestRef.current;
    setFolderMenu(null);
    setOpeningFolder({ path, name: basenameOfPath(path) });
    void actions.openFolder(path)
      .catch((e) => {
        if (requestId !== openingRequestRef.current) return;
        const msg = errorMessage(e);
        // Remove the failed entry immediately so a stale/deleted path
        // doesn't remain clickable if the server refresh also fails.
        dispatch({
          type: 'WELCOME_SHOW',
          recent: state.recent.filter((r) => r.path !== path),
          homeDir: state.homeDir,
          error: msg,
        });
        void api.getFolder()
          .then((j) => dispatch({ type: 'WELCOME_SHOW', recent: j.recent ?? [], homeDir: j.homeDir, error: msg }))
          .catch(() => { /* keep the optimistic removal + original open error */ });
      })
      .finally(() => {
        if (requestId === openingRequestRef.current) setOpeningFolder(null);
      });
  }

  async function openRecentInNewWindow(path: string) {
    setFolderMenu(null);
    const bridge = (window as { electron?: ElectronBridge }).electron;
    const opened = await bridge?.openFolderWindow?.(path);
    if (!opened) {
      dispatch({
        type: 'WELCOME_ERROR',
        error: 'New window is only available in the desktop app.',
      });
    }
  }

  if (!state.welcomeVisible) return null;

  const removeTarget = confirmRemove
    ? (() => {
        const segs = confirmRemove.split('/').filter(Boolean);
        const name = segs.pop() || confirmRemove;
        const parent = prettifyHome(segs.length ? '/' + segs.join('/') : '/', state.homeDir ?? '');
        return { path: confirmRemove, name, parent };
      })()
    : null;

  const visibleFolders = tagFilter === 'favorites'
    ? state.recent.filter((r) => r.favorite)
    : state.recent;

  return (
    <div className="welcome fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-pane text-foreground">
      <div className="welcome-inner mt-[clamp(94px,17vh,150px)] w-[min(700px,calc(100vw-56px))] pt-5 pb-8 max-[720px]:mt-14 max-[720px]:w-[min(100%,calc(100vw-28px))]">
        <div className="welcome-rise mb-7 grid grid-cols-[auto_1fr] items-center gap-x-3.5 gap-y-1">
          <div className="row-span-2 size-12 *:size-full">
            <CubeLogoIcon />
          </div>
          <div className="text-4xl font-semibold tracking-tight">
            StashBase<span className="text-accent-amber">.</span>
          </div>
          <div className="text-lg leading-snug text-muted-foreground">
            Open or create a folder to build your searchable library.
          </div>
        </div>

        <div className="welcome-rise [animation-delay:60ms]">
          {/* The chips row IS the section header (Notion Library pattern):
            * chips name the views on the left, actions sit on the right.
            * No separate title — the brand tagline above already names
            * the library. */}
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1">
              {([
                { key: 'recents', label: 'Recents', Icon: HistoryIcon },
                { key: 'favorites', label: 'Favorites', Icon: StarIcon },
              ] as const).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent px-3 text-base transition-colors [&_svg]:size-3.5 ${
                    tagFilter === key
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                  aria-pressed={tagFilter === key}
                  onClick={() => setTagFilter(key)}
                >
                  <Icon />
                  {label}
                </button>
              ))}
            </div>
            <span className="flex shrink-0 items-center gap-2">
              <OpenFolderButton
                primary
                disabled={!!openingFolder}
                onOpeningFolder={setOpeningFolder}
              />
              <NewFolderButton
                disabled={!!openingFolder}
                folderHome={folderHome}
                refreshFolderHome={refreshFolderHome}
                onOpeningFolder={setOpeningFolder}
              />
            </span>
          </div>
          <Card variant="raised" className="overflow-hidden">
          {/* No vertical padding: row 1 sits flush under the card edge.
            * Height tracks the viewport (~430px chrome overhead above and
            * below), never below 6.5 rows so small windows keep a useful
            * list and the cut row doubles as the scroll affordance. */}
          <div className="flex max-h-[max(286px,calc(100vh-430px))] flex-col overflow-y-auto">
            {visibleFolders.length === 0 && (
              <div className="px-6 py-9 text-center text-base text-muted-foreground">
                {tagFilter === 'favorites'
                  ? 'No favorites yet — star a folder from its ⋯ menu.'
                  : 'Your library is empty — open a folder to make it searchable.'}
              </div>
            )}
            {visibleFolders.length > 0 && (
              <>
                {visibleFolders.map((r) => {
                  const segs = r.path.split('/').filter(Boolean);
                  const name = segs.pop() || r.path;
                  const parent = prettifyHome(segs.length ? '/' + segs.join('/') : '/', state.homeDir ?? '');
                  const indexSnapshot = folderIndexSnapshots[r.path] ?? {
                    state: state.libraryFolderStatuses[r.path] ?? 'unknown',
                    total: 0,
                    pending: 0,
                    converting: 0,
                  };
                  const indexState = indexSnapshot.state;
                  const menuOpen = folderMenu?.path === r.path;
                  return (
                    <div
                      key={r.path}
                      className={`group relative flex min-h-11 w-full cursor-pointer items-center border-b border-border px-4 transition-colors last:border-b-0 ${
                        menuOpen
                          ? 'bg-muted'
                          : 'hover:bg-muted has-[button:first-child:disabled]:hover:bg-transparent'
                      }`}
                      onClick={() => openRecent(r.path)}
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 border-0 bg-transparent pr-2 text-left text-foreground disabled:cursor-default"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRecent(r.path);
                        }}
                      >
                        {/* Naked glyph, no chip: chips earn their place
                          * framing rich brand marks (MCP clients); around
                          * a gray outline they read as empty boxes. */}
                        <FolderIcon className="mx-0.5 size-4 shrink-0 text-muted-foreground opacity-80 [&_path]:stroke-[1.8]" />
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="max-w-[36%] min-w-0 truncate text-base font-semibold">{name}</span>
                          {r.favorite && (
                            <StarIcon className="size-3.5 shrink-0 text-muted-foreground" aria-label="Favorite" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground max-[720px]:hidden" title={r.path}>{parent}</span>
                          {indexState === 'failed' && (
                            <span
                              className="welcome-recent-status mr-1.5 inline-flex size-[18px] shrink-0 items-center justify-center text-muted-foreground opacity-90 [&_svg]:size-4"
                              aria-label="Search needs attention"
                              title="Some files in this folder could not be prepared for search."
                            >
                              <WarningMark />
                            </span>
                          )}
                        </span>
                        {formatOpenedAt(r.openedAt) && (
                          <span className={`shrink-0 pl-3 text-sm text-muted-foreground max-[720px]:hidden ${menuOpen ? 'invisible' : 'group-hover:invisible group-focus-within:invisible'}`}>
                            {formatOpenedAt(r.openedAt)}
                          </span>
                        )}
                      </button>
                      {/* Gmail-style swap: at rest the time owns the right
                        * edge; on hover (or while this row's menu is open)
                        * the action cluster overlays that same slot instead
                        * of reserving a permanent blank gutter. Favorite
                        * state itself lives quietly next to the name. */}
                      <span
                        className={`absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1 ${
                          menuOpen ? '' : 'opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100'
                        }`}
                      >
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className={`shrink-0 text-muted-foreground ${
                            r.favorite ? '[&_svg]:fill-current' : ''
                          }`}
                          aria-pressed={!!r.favorite}
                          aria-label={r.favorite ? `Remove ${name} from Favorites` : `Add ${name} to Favorites`}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Mouse clicks (detail > 0) blur so the action
                            // cluster retracts on mouse-leave; keyboard
                            // activation keeps focus for continued tabbing.
                            if (e.detail > 0) e.currentTarget.blur();
                            toggleFavorite(r.path);
                          }}
                        >
                          <StarIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="shrink-0 text-muted-foreground aria-expanded:bg-border aria-expanded:text-foreground"
                          aria-label={`More actions for ${name}`}
                          aria-haspopup="menu"
                          aria-expanded={menuOpen}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFolderMenu({ path: r.path, name, rect: e.currentTarget.getBoundingClientRect() });
                          }}
                        >
                          <MoreHorizontalIcon />
                        </Button>
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
          </Card>
        </div>

        {state.welcomeError && (
          <StatusMessage tone="error" className="mt-3.5">
            {state.welcomeError}
          </StatusMessage>
        )}
      </div>
      {openingFolder && (
        <StatusMessage className="welcome-loading">
          <div className="welcome-loading-spinner" />
          <div className="welcome-loading-text">Opening {openingFolder.name}</div>
        </StatusMessage>
      )}
      {folderMenu && (
        <Menu
          anchor={{ rect: folderMenu.rect, align: 'right' }}
          minWidth={210}
          items={[
            {
              label: state.recent.find((r) => r.path === folderMenu.path)?.favorite ? 'Remove from Favorites' : 'Add to Favorites',
              icon: <StarIcon />,
              onSelect: () => toggleFavorite(folderMenu.path),
            },
            {
              label: 'Open in New Window',
              icon: <ExternalLinkIcon />,
              onSelect: () => { void openRecentInNewWindow(folderMenu.path); },
            },
            { separator: true },
            {
              label: 'Remove from Library',
              icon: <TrashIcon />,
              detail: 'Will not delete local files',
              danger: true,
              onSelect: () => setConfirmRemove(folderMenu.path),
            },
          ] satisfies MenuItem[]}
          onClose={() => setFolderMenu(null)}
        />
      )}
      {removeTarget && (
        <ModalShell
          title="Remove from Library?"
          description={
            <>
            StashBase will remove <strong className="font-semibold text-accent">{removeTarget.name}</strong> from your Library.
            It will <strong>not</strong> delete the folder or its files from your disk.
            </>
          }
          onCancel={removing ? () => { /* wait for removal */ } : () => setConfirmRemove(null)}
          top
        >
          <div className="mt-2 truncate text-sm text-muted-foreground" title={removeTarget.path}>
            {removeTarget.parent}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={removing}
              onClick={() => setConfirmRemove(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={removing}
              onClick={() => removeFolder(removeTarget.path)}
            >
              {removing ? 'Removing…' : 'Remove'}
            </Button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function WarningMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path className="warning-mark-shape" d="M8 2.2 14.4 13.2H1.6L8 2.2Z" />
      <text className="warning-mark-text" x="8" y="12" textAnchor="middle">!</text>
    </svg>
  );
}

/** "Open folder" action — pick ANY folder on disk (anywhere, any nesting
 *  level) and open it in place. Nothing is copied: the folder is indexed
 *  where it lives. Browser fallback (no Electron bridge)
 *  hides the button — no portable absolute-path picker. */
function OpenFolderButton({
  shortLabel = false,
  primary = false,
  disabled = false,
  onOpeningFolder,
}: {
  shortLabel?: boolean;
  primary?: boolean;
  disabled?: boolean;
  onOpeningFolder?: (folder: { path: string; name: string } | null) => void;
}) {
  const { actions, dispatch } = useApp();
  const [busy, setBusy] = useState(false);
  const bridge = useMemo<ElectronBridge | undefined>(
    () => (window as { electron?: ElectronBridge }).electron,
    [],
  );
  if (typeof bridge?.openFolderDialog !== 'function') return null;
  async function onClick() {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const picked = await bridge!.openFolderDialog!({
        title: 'Select folder',
        buttonLabel: 'Select folder',
        allowCreateDirectory: true,
      });
      if (picked) {
        onOpeningFolder?.({ path: picked, name: basenameOfPath(picked) });
        await actions.openFolder(picked);
      }
    } catch (err) {
      dispatch({ type: 'WELCOME_ERROR', error: errorMessage(err) });
    } finally {
      onOpeningFolder?.(null);
      setBusy(false);
    }
  }
  return (
    <Button
      variant={primary ? 'default' : 'outline'}
      className="h-8 gap-2 px-3.5 text-base font-medium has-data-[icon=inline-start]:pl-3"
      onClick={onClick}
      disabled={busy || disabled}
      title="Add any folder on your disk to the library — indexed in place, not copied"
    >
      <FolderIcon data-icon="inline-start" />
      {shortLabel ? 'Open' : 'Open folder'}
    </Button>
  );
}

/** Same native picker as Open folder, but starts at the default StashBase
 *  home so the OS panel's New Folder button lands in the expected place. */
function NewFolderButton({
  folderHome,
  refreshFolderHome,
  shortLabel = false,
  disabled = false,
  onOpeningFolder,
}: {
  folderHome: string;
  refreshFolderHome: () => Promise<string>;
  shortLabel?: boolean;
  disabled?: boolean;
  onOpeningFolder?: (folder: { path: string; name: string } | null) => void;
}) {
  const { actions, dispatch } = useApp();
  const [busy, setBusy] = useState(false);
  const bridge = useMemo<ElectronBridge | undefined>(
    () => (window as { electron?: ElectronBridge }).electron,
    [],
  );

  if (typeof bridge?.openFolderDialog !== 'function') return null;

  async function onClick() {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const defaultPath = folderHome || await refreshFolderHome();
      const picked = await bridge!.openFolderDialog!({
        title: 'Create or select folder',
        buttonLabel: 'Select folder',
        defaultPath,
        allowCreateDirectory: true,
      });
      if (picked) {
        onOpeningFolder?.({ path: picked, name: basenameOfPath(picked) });
        await actions.openFolder(picked);
      }
    } catch (err) {
      dispatch({ type: 'WELCOME_ERROR', error: errorMessage(err) });
    } finally {
      onOpeningFolder?.(null);
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      className="h-8 gap-2 px-3.5 text-base font-medium has-data-[icon=inline-start]:pl-3"
      onClick={onClick}
      disabled={busy || disabled}
      title="Create or choose a folder under the default StashBase location and add it to the library"
    >
      <NewFolderIcon data-icon="inline-start" />
      {shortLabel ? 'New' : 'New folder'}
    </Button>
  );
}
