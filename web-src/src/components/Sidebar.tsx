import {
  ChevronDownIcon,
  CollapseAllIcon,
  CubeLogoIcon,
  ExpandAllIcon,
  ExternalLinkIcon,
  FolderIcon,
  MoreHorizontalIcon,
  NewChatIcon,
  NewFileIcon,
  NewFolderIcon,
  PlusIcon,
  StarIcon,
  SyncIcon,
  TrashIcon,
} from '../icons';
import { useApp } from '../store/AppContext';
import { makeChatTab, type LibraryFolderStatus } from '../store/state';
import { blankTabToReuse } from './agent/folderState';
import { readPreferredAgent } from '../agentPreference';
import { folderRefsEqual } from '../folderPath';
import { ActivityBar } from './ActivityBar';
import { FileTree } from './FileTree';
import { DocumentOutline } from './DocumentOutline';
import { useDocumentOutline } from './DocumentOutlineContext';
import { Menu, type MenuItem } from './Menu';
import { ModalShell } from './ModalShell';
import { SearchPanel } from './SearchPanel';
import { Button } from './ui/button';
import { api, errorMessage, type IndexStatus } from '../api';
import { FILE_MIME } from '../dragMime';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';

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

const LIBRARY_RECONCILE_COOLDOWN_MS = 30_000;
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

/** Collapse a folder's `/api/index-status` payload to the coarse library
 *  readiness state the sidebar cares about. Only `failed` is surfaced (a
 *  subtle warning dot); `preparing`/`unknown` merely keep the poll alive. */
function libraryFolderState(status: IndexStatus): LibraryFolderStatus {
  const hasError = status.indexWarning
    || (status.preparationFailures?.some((problem) => problem.status !== 'cancelled') ?? false);
  const pending = status.pendingCount ?? 0;
  const converting = status.pendingConversions?.length ?? 0;
  const indexReady = status.indexReady !== false;
  const isIndexing = !indexReady
    || status.visibleIndexingSettled === false
    || pending > 0
    || converting > 0;
  return hasError ? 'failed' : isIndexing ? 'preparing' : 'ready';
}

/**
 * Left rail composition. The activity bar (narrow icon column on the
 * far left) toggles between two mutually-exclusive side panels:
 *   - Files   → the Library folder list + the active folder's file tree
 *   - Search  → search input + ≈/= toggle + result list (see
 *               `SearchPanel.tsx`)
 *
 * Each panel keeps its own state when hidden — flipping back doesn't
 * blow away tree expansion or the active query.
 */
export function Sidebar() {
  const { state } = useApp();
  return (
    /* Explicit h-full so the inner file list (flex-1) knows how much to
     * grow into; overflow-hidden clips content as the grid column
     * resizes / collapses to the bare 44px rail — without it, file
     * names visually spill into the main pane mid-transition.
     * `group/sidebar` drives the hover-reveal of the header action
     * icons (see the side-actions class strings below). */
    <aside className="sidebar group/sidebar relative flex h-full min-h-0 min-w-0 flex-row overflow-hidden border-r border-border bg-pane">
      <ActivityBar />
      {/* The panel that swaps content based on `state.activeSidebarView`;
        * it owns the vertical stack (header / list). */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {state.activeSidebarView === 'search' ? <SearchPanel /> : <FilesPanel />}
      </div>
    </aside>
  );
}

/* Header action icons stay invisible until the pointer is over the
 * sidebar, mirroring VS Code's quiet explorer toolbar. */
const sideActionsClass =
  'flex gap-0.5 opacity-0 transition-opacity duration-fast group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100';

/* Top tier of the VSCode-style two-row header: a quiet section label on
 * the left; chevron rotation is keyed off the toggle's aria-expanded so
 * the visual state can never drift from the accessible one. */
const sectionToggleClass =
  'inline-flex min-w-0 flex-1 cursor-pointer items-center gap-0.5 border-0 bg-transparent p-0 text-left '
  + 'text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:outline-none '
  + '[&>svg]:size-3.5 [&>svg]:flex-none [&>svg]:transition-transform [&>svg]:duration-fast '
  + 'aria-[expanded=false]:[&>svg]:-rotate-90';

const sectionTitleClass =
  'min-w-0 truncate text-xs font-semibold tracking-[.06em] uppercase text-muted-foreground';

/** The Explorer view. The Library folder list (with the active folder's
 * file tree expanded in place) and the active Markdown document outline
 * share this one sidebar as independently collapsible sections. */
function FilesPanel() {
  const { activeTab } = useApp();
  const { outline } = useDocumentOutline();
  const [libraryExpanded, setLibraryExpanded] = useState(true);
  const [outlineExpanded, setOutlineExpanded] = useState(true);

  const hasMarkdownDocument = activeTab?.file?.format === 'md';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" id="sidebar-panel-files" role="tabpanel">
      <NewChatButton />
      {/* Explorer sections mirror VS Code's compact disclosure rows. The
        * library list and the active document's outline intentionally share
        * one navigation surface; neither becomes a floating editor companion. */}
      <section className={'flex min-h-0 flex-col overflow-hidden border-b border-border ' + (libraryExpanded ? 'flex-[3_1_0%]' : 'flex-none')}>
        <div className="flex min-h-[30px] items-center gap-1.5 pt-2 pr-2 pb-0.5 pl-3">
          <button
            type="button"
            className={sectionToggleClass + ' flex-none'}
            aria-expanded={libraryExpanded}
            aria-controls="sidebar-files-section"
            onClick={() => setLibraryExpanded((expanded) => !expanded)}
          ><ChevronDownIcon /><span className={sectionTitleClass}>Library</span></button>
          <div className={sideActionsClass + ' ml-auto'}>
            <AddFolderMenuButton />
          </div>
        </div>
        <div id="sidebar-files-section" className={libraryExpanded ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'hidden'}>
          <LibraryList visible={libraryExpanded} />
        </div>
      </section>
      {hasMarkdownDocument && (
        <section className={'flex min-h-0 flex-col overflow-hidden border-b border-border ' + (outlineExpanded ? 'flex-[2_1_0%]' : 'flex-none')}>
          <div className="flex min-h-[30px] items-center justify-between gap-1.5 py-[5px] pr-2 pl-3">
            <button type="button" className={sectionToggleClass} aria-expanded={outlineExpanded} aria-controls="sidebar-outline-section" onClick={() => setOutlineExpanded((expanded) => !expanded)}>
              <ChevronDownIcon /><span className={sectionTitleClass + ' flex-1'}>Document Outline</span><span className="ml-auto flex-none text-2xs text-muted-foreground">{outline.headings.length}</span>
            </button>
          </div>
          <div id="sidebar-outline-section" className={outlineExpanded ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'hidden'}>
            <DocumentOutline headings={outline.headings} activeId={outline.activeId} onSelect={outline.onSelect} />
          </div>
        </section>
      )}
    </div>
  );
}

/** Full-width New Chat entry above the Library section (Cursor's "New
 *  Agent" position). Opens the chat panel on a tab scoped to the window's
 *  current folder — or to the whole Library when no folder is current.
 *  Reuses a completely blank tab when one exists (preferring the
 *  preferred agent's); otherwise creates a fresh tab for the preferred
 *  agent. The reused/created tab's scope resolves to the window default
 *  on connect, so no scope needs to be threaded here. */
function NewChatButton() {
  const { state, dispatch } = useApp();

  function newChat() {
    const agent = readPreferredAgent();
    const reuseId = blankTabToReuse(state.chatTabs, agent);
    if (reuseId) dispatch({ type: 'CHAT_TAB_ACTIVATE', id: reuseId });
    else dispatch({ type: 'CHAT_TAB_NEW', tab: makeChatTab(agent, state.chatTabs) });
    if (!state.chatOpen) dispatch({ type: 'CHAT_TOGGLE' });
  }

  return (
    <div className="border-b border-border px-2 py-1.5">
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-center gap-1.5"
        title="Start a chat in the current folder, or across the whole library"
        onClick={newChat}
      >
        <NewChatIcon className="size-3.5" />
        New Chat
      </Button>
    </div>
  );
}

/** `+` in the Library header — a shared menu for both add-folder flows.
 *  "Open Folder…" picks any folder on disk and opens it in place (nothing
 *  is copied; it is indexed where it lives). "New Folder…" opens the same
 *  native picker at the default StashBase home so the OS panel's New
 *  Folder button lands in the expected place. Browser mode (no Electron
 *  bridge) has no portable absolute-path picker, so the button hides. */
function AddFolderMenuButton() {
  const { actions } = useApp();
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const bridge = useMemo<ElectronBridge | undefined>(
    () => (window as { electron?: ElectronBridge }).electron,
    [],
  );
  if (typeof bridge?.openFolderDialog !== 'function') return null;

  async function openExistingFolder() {
    try {
      const picked = await bridge!.openFolderDialog!({
        title: 'Select folder',
        buttonLabel: 'Select folder',
        allowCreateDirectory: true,
      });
      if (picked) await actions.openFolder(picked);
    } catch (err) {
      actions.toast('Could not open the folder: ' + errorMessage(err), { level: 'error' });
    }
  }

  async function newFolderFromHome() {
    try {
      const { path } = await api.getFolderHome();
      const picked = await bridge!.openFolderDialog!({
        title: 'Create or select folder',
        buttonLabel: 'Select folder',
        defaultPath: path,
        allowCreateDirectory: true,
      });
      if (picked) await actions.openFolder(picked);
    } catch (err) {
      actions.toast('New folder failed: ' + errorMessage(err), { level: 'error' });
    }
  }

  const items: MenuItem[] = [
    {
      label: 'Open Folder…',
      icon: <FolderIcon />,
      title: 'Add any folder on your disk to the library — indexed in place, not copied',
      onSelect: () => { void openExistingFolder(); },
    },
    {
      label: 'New Folder…',
      icon: <NewFolderIcon />,
      title: 'Create or choose a folder under the default StashBase location',
      onSelect: () => { void newFolderFromHome(); },
    },
  ];

  return (
    <>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground aria-expanded:bg-border aria-expanded:text-foreground"
        title="Add folder to library"
        aria-label="Add folder to library"
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={() => {
          if (anchor) { setAnchor(null); return; }
          const rect = buttonRef.current?.getBoundingClientRect();
          if (rect) setAnchor(rect);
        }}
      ><PlusIcon /></Button>
      {anchor && (
        <Menu
          anchor={{ rect: anchor, align: 'right' }}
          minWidth={190}
          items={items}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
}

/** The Library folder list — every library folder as a root row, with the
 *  window's current folder expanded to its file tree in place (one
 *  expanded root at a time; clicking another root switches this window's
 *  folder). Favorited folders pin to the top; the rest keep recents order. */
function LibraryList({ visible }: { visible: boolean }) {
  const { state, actions, dispatch } = useApp();
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [folderMenu, setFolderMenu] = useState<{ path: string; name: string; rect: DOMRect } | null>(null);
  const [folderStates, setFolderStates] = useState<Record<string, LibraryFolderStatus>>({});
  const [openingFolder, setOpeningFolder] = useState<{ path: string; name: string } | null>(null);
  const reconcileStartedAt = useRef<Map<string, number>>(new Map());
  const openingRequestRef = useRef(0);
  const bridge = useMemo<ElectronBridge | undefined>(
    () => (window as { electron?: ElectronBridge }).electron,
    [],
  );

  const isCurrent = useCallback(
    (path: string) => !!state.folderPath && folderRefsEqual(state.folderPath, path),
    [state.folderPath],
  );

  // Favorites pin to the top; both groups keep the server's recents order.
  const roots = useMemo(() => {
    const favorites = state.recent.filter((entry) => entry.favorite);
    const others = state.recent.filter((entry) => !entry.favorite);
    const ordered = [...favorites, ...others];
    // A just-opened folder can precede the library refresh by a beat —
    // keep the current root visible rather than dropping the tree.
    if (state.folderPath && !ordered.some((entry) => folderRefsEqual(entry.path, state.folderPath))) {
      ordered.unshift({ path: state.folderPath, openedAt: '', favorite: false });
    }
    return ordered;
  }, [state.folderPath, state.recent]);

  const otherRootPathsKey = roots
    .filter((entry) => !isCurrent(entry.path))
    .map((entry) => entry.path)
    .join('\n');

  // Optimistic star toggle: flip in the store immediately, persist in the
  // background, and re-sync from the server if the write fails.
  const toggleFavorite = useCallback((path: string) => {
    setFolderMenu(null);
    const entry = state.recent.find((r) => r.path === path);
    if (!entry) return;
    const favorite = !entry.favorite;
    dispatch({
      type: 'RECENT_LOADED',
      recent: state.recent.map((r) => (r.path === path ? { ...r, favorite } : r)),
      homeDir: state.homeDir,
    });
    void api.setFolderFavorite(path, favorite).catch((e) => {
      actions.toast(errorMessage(e), { level: 'error' });
      void api.getFolder()
        .then((j) => dispatch({ type: 'RECENT_LOADED', recent: j.recent ?? [], homeDir: j.homeDir }))
        .catch(() => { /* keep the optimistic flip until the next refresh */ });
    });
  }, [actions, dispatch, state.homeDir, state.recent]);

  const removeFolder = useCallback((path: string) => {
    setRemoving(true);
    void (async () => {
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
      dispatch({ type: 'RECENT_LOADED', recent: j.recent ?? [], homeDir: j.homeDir });
    })()
      .catch((e) => actions.toast(errorMessage(e), { level: 'error' }))
      .finally(() => { setRemoving(false); setConfirmRemove(null); });
  }, [actions, bridge, dispatch]);

  const openRoot = useCallback((path: string) => {
    if (isCurrent(path)) return;
    const requestId = ++openingRequestRef.current;
    setFolderMenu(null);
    setOpeningFolder({ path, name: basenameOfPath(path) });
    void actions.openFolder(path)
      .catch((e) => {
        if (requestId !== openingRequestRef.current) return;
        const msg = errorMessage(e);
        actions.toast(msg, { level: 'error' });
        // Remove the failed entry immediately so a stale/deleted path
        // doesn't remain clickable if the server refresh also fails.
        dispatch({
          type: 'RECENT_LOADED',
          recent: state.recent.filter((r) => r.path !== path),
          homeDir: state.homeDir,
        });
        void api.getFolder()
          .then((j) => dispatch({ type: 'RECENT_LOADED', recent: j.recent ?? [], homeDir: j.homeDir }))
          .catch(() => { /* keep the optimistic removal */ });
      })
      .finally(() => {
        if (requestId === openingRequestRef.current) setOpeningFolder(null);
      });
  }, [actions, dispatch, isCurrent, state.homeDir, state.recent]);

  const openRootInNewWindow = useCallback(async (path: string) => {
    setFolderMenu(null);
    const opened = await bridge?.openFolderWindow?.(path);
    if (!opened) {
      actions.toast('New window is only available in the desktop app.', { level: 'error' });
    }
  }, [actions, bridge]);

  // Watchdog: a folder open that neither resolves nor rejects should not
  // leave the row stuck in its busy state forever.
  useEffect(() => {
    if (!openingFolder) return undefined;
    const opening = openingFolder;
    const timer = setTimeout(() => {
      setOpeningFolder(null);
      actions.toast(
        `Opening ${opening.name} is taking longer than expected. Please try again.`,
        { level: 'error' },
      );
    }, OPEN_FOLDER_WATCHDOG_MS);
    return () => clearTimeout(timer);
  }, [actions, openingFolder]);

  // Poll non-current folders' index status while the list is visible so
  // collapsed roots can show a quiet needs-attention dot. The current
  // folder's readiness is owned by the in-folder surfaces (tree markers,
  // Search view), which can point at the affected files.
  useEffect(() => {
    const paths = otherRootPathsKey ? otherRootPathsKey.split('\n') : [];
    if (!visible || openingFolder || paths.length === 0) {
      setFolderStates({});
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function refreshFolderStates() {
      const entries = await Promise.all(paths.map(async (path) => {
        try {
          const status = await api.indexStatus(path);
          return [path, libraryFolderState(status)] as const;
        } catch {
          return [path, state.libraryFolderStatuses[path] ?? 'unknown'] as const;
        }
      }));
      if (cancelled) return;
      const fresh = Object.fromEntries(entries) as Record<string, LibraryFolderStatus>;
      setFolderStates(fresh);
      const keepPolling = Object.values(fresh).some((s) => s === 'preparing' || s === 'unknown');
      if (keepPolling) timer = setTimeout(refreshFolderStates, 1500);
    }
    timer = setTimeout(refreshFolderStates, 750);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [openingFolder, otherRootPathsKey, state.libraryFolderStatuses, visible]);

  // Background reconcile for the non-current library folders, with a
  // per-folder cooldown: previous library work (conversions, indexing)
  // may still be incomplete, and status polling alone is not recovery.
  useEffect(() => {
    const paths = otherRootPathsKey ? otherRootPathsKey.split('\n') : [];
    if (!visible || openingFolder || paths.length === 0) return undefined;
    const timer = setTimeout(() => {
      const now = Date.now();
      for (const path of paths) {
        const lastStarted = reconcileStartedAt.current.get(path) ?? 0;
        if (now - lastStarted < LIBRARY_RECONCILE_COOLDOWN_MS) continue;
        reconcileStartedAt.current.set(path, now);
        void api.sync(path)
          .catch((err) => {
            console.warn(`[library] reconcile failed for ${path}:`, err);
          });
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [openingFolder, otherRootPathsKey, visible]);

  const removeTarget = confirmRemove
    ? (() => {
        const segs = confirmRemove.split('/').filter(Boolean);
        const name = segs.pop() || confirmRemove;
        const parent = prettifyHome(segs.length ? '/' + segs.join('/') : '/', state.homeDir ?? '');
        return { path: confirmRemove, name, parent };
      })()
    : null;

  if (roots.length === 0) return <ZeroFolderState />;

  const menuEntry = folderMenu ? state.recent.find((r) => r.path === folderMenu.path) : null;

  return (
    <div className="flex-1 overflow-y-auto pb-2">
      {roots.map((entry) => {
        const current = isCurrent(entry.path);
        const name = basenameOfPath(entry.path);
        if (current) {
          return (
            <CurrentRootRow
              key={entry.path}
              name={name}
              path={entry.path}
              favorite={!!entry.favorite}
              onMenu={(rect) => setFolderMenu({ path: entry.path, name, rect })}
              menuOpen={folderMenu?.path === entry.path}
            />
          );
        }
        const opening = openingFolder?.path === entry.path;
        const needsAttention = folderStates[entry.path] === 'failed';
        const menuOpen = folderMenu?.path === entry.path;
        return (
          <div
            key={entry.path}
            className={`group/root relative flex min-h-[26px] items-center pr-2 ${
              menuOpen ? 'bg-muted' : 'hover:bg-muted'
            }${opening ? ' opacity-60' : ''}`}
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 border-0 bg-transparent py-[3px] pr-1 pl-1 text-left text-base text-foreground disabled:cursor-default"
              disabled={!!openingFolder}
              title={entry.path}
              onClick={() => openRoot(entry.path)}
            >
              <span className={'inline-flex size-4 flex-none items-center justify-center text-muted-foreground [&_svg]:size-3.5' + (opening ? ' [&_svg]:animate-spin' : ' [&_svg]:-rotate-90')}>
                {opening ? <SyncIcon /> : <ChevronDownIcon />}
              </span>
              <span className="min-w-0 truncate font-semibold">{name}</span>
              {entry.favorite && (
                <StarIcon className="size-3 shrink-0 fill-current text-muted-foreground" aria-label="Favorite" />
              )}
              {needsAttention && (
                <span
                  className="size-1.5 shrink-0 rounded-full bg-status-warning"
                  role="img"
                  aria-label="Search needs attention"
                  title="Some files in this folder could not be prepared for search."
                />
              )}
            </button>
            <span
              className={`flex items-center ${
                menuOpen ? '' : 'opacity-0 transition-opacity duration-fast group-focus-within/root:opacity-100 group-hover/root:opacity-100'
              }`}
            >
              <RootMenuButton
                name={name}
                menuOpen={menuOpen}
                onMenu={(rect) => setFolderMenu({ path: entry.path, name, rect })}
              />
            </span>
          </div>
        );
      })}
      {folderMenu && (
        <Menu
          anchor={{ rect: folderMenu.rect, align: 'right' }}
          minWidth={210}
          items={[
            {
              label: menuEntry?.favorite ? 'Remove from Favorites' : 'Add to Favorites',
              icon: <StarIcon />,
              onSelect: () => toggleFavorite(folderMenu.path),
            },
            ...(bridge?.openFolderWindow ? [{
              label: 'Open in New Window',
              icon: <ExternalLinkIcon />,
              onSelect: () => { void openRootInNewWindow(folderMenu.path); },
            } satisfies MenuItem] : []),
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

/** The ⋯ trigger shared by every root row. */
function RootMenuButton({
  name,
  menuOpen,
  onMenu,
}: {
  name: string;
  menuOpen: boolean;
  onMenu: (rect: DOMRect) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className="shrink-0 text-muted-foreground aria-expanded:bg-border aria-expanded:text-foreground"
      aria-label={`More actions for ${name}`}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      onClick={(e) => {
        e.stopPropagation();
        onMenu(e.currentTarget.getBoundingClientRect());
      }}
    >
      <MoreHorizontalIcon />
    </Button>
  );
}

/** The expanded root — the window's current folder. Carries the classic
 *  explorer toolbar (new note / new folder / sync / fold) plus the same
 *  ⋯ folder menu as the collapsed roots, and hosts the file tree. The
 *  `#sideHead` id and `drop-target` / `active-root` state classes stay
 *  CSS-driven: `useGlobalDragDrop` toggles `drop-target` imperatively on
 *  #sideHead, and both rules share the tree's exempted selected/drop
 *  styling (see sidebar.css). */
function CurrentRootRow({
  name,
  path,
  favorite,
  menuOpen,
  onMenu,
}: {
  name: string;
  path: string;
  favorite: boolean;
  menuOpen: boolean;
  onMenu: (rect: DOMRect) => void;
}) {
  const { state, actions, dispatch } = useApp();
  const [sideHeadDrop, setSideHeadDrop] = useState(false);

  function onSideHeadDragOver(e: DragEvent<HTMLDivElement>) {
    if (!e.dataTransfer.types.includes('Files') && !e.dataTransfer.types.includes(FILE_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    setSideHeadDrop(true);
  }
  function onSideHeadDragLeave() { setSideHeadDrop(false); }
  function onSideHeadDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setSideHeadDrop(false);
    const internal = e.dataTransfer.getData(FILE_MIME);
    if (internal) {
      void actions.moveFile(internal, '');
    }
    // External imports are handled by the global drop listener which
    // computes its target from the cursor's `.tree-row.folder` /
    // `#sideHead` closest. We don't double-handle here.
  }

  const rootSelected = state.selectedPath === '';

  return (
    <>
      <div
        id="sideHead"
        className={
          'side-head flex min-h-[26px] items-center gap-1 py-0.5 pr-2 pl-1'
          + (sideHeadDrop ? ' drop-target' : '')
          + (rootSelected ? ' active-root' : '')
        }
        onDragOver={onSideHeadDragOver}
        onDragLeave={onSideHeadDragLeave}
        onDrop={onSideHeadDrop}
      >
        <span className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 text-foreground">
          <span
            className={'inline-flex size-4 flex-none items-center justify-center text-muted-foreground transition-transform duration-fast [&_svg]:size-3.5' + (state.folderCollapsed ? ' -rotate-90' : '')}
            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'FOLDER_FOLD_TOGGLE' }); }}
          ><ChevronDownIcon /></span>
          <span
            className="min-w-0 flex-1 truncate text-base font-semibold"
            title={path}
            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ACTIVE_FOLDER', path: '' }); }}
          >{name}</span>
          {favorite && (
            <StarIcon className="size-3 shrink-0 fill-current text-muted-foreground" aria-label="Favorite" />
          )}
        </span>
        <div className={menuOpen ? 'flex gap-0.5' : sideActionsClass}>
          <NewNoteButton />
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground" title={'New folder in ' + (state.activeFolder || name)} onClick={() => {
            if (state.activeFolder) dispatch({ type: 'EXPAND_FOLDER', path: state.activeFolder });
            dispatch({ type: 'NEW_FOLDER_INPUT', open: true });
          }}><NewFolderIcon /></Button>
          <SyncButton />
          <FolderFoldToggle />
          <RootMenuButton name={name} menuOpen={menuOpen} onMenu={onMenu} />
        </div>
      </div>
      {/* Collapsing hides the list but leaves the `expanded` set in
        * state untouched, so re-expanding restores every inner
        * folder's prior open/closed state. */}
      {!state.folderCollapsed && <FileTree />}
    </>
  );
}

/** Zero-folder library: the one place sidebar chrome is allowed a small
 *  brand-warmth moment (see visual-style's warmth budget) — the app mark,
 *  a single line of guidance, and the primary add-folder action. */
function ZeroFolderState() {
  const { actions } = useApp();
  const bridge = useMemo<ElectronBridge | undefined>(
    () => (window as { electron?: ElectronBridge }).electron,
    [],
  );

  async function addFolder() {
    try {
      const picked = await bridge!.openFolderDialog!({
        title: 'Select folder',
        buttonLabel: 'Select folder',
        allowCreateDirectory: true,
      });
      if (picked) await actions.openFolder(picked);
    } catch (err) {
      actions.toast('Could not open the folder: ' + errorMessage(err), { level: 'error' });
    }
  }

  return (
    <div className="flex flex-col items-start gap-3 px-4 pt-5 pb-4">
      <div className="size-9 *:size-full"><CubeLogoIcon /></div>
      <p className="m-0 text-base leading-snug text-muted-foreground">
        Add a folder to build your searchable library.
      </p>
      {typeof bridge?.openFolderDialog === 'function' && (
        <Button onClick={() => { void addFolder(); }}>Add Folder…</Button>
      )}
    </div>
  );
}

/** "+" icon in the sidebar header that creates a new Markdown note in
 *  the active folder. HTML notes were dropped once their editor went
 *  away, so there's no format picker — one click, one .md draft. */
function NewNoteButton() {
  const { state, actions } = useApp();
  const target = state.activeFolder || state.folder || 'folder root';

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground"
      title={'New note in ' + target}
      onClick={() => void actions.newNote()}
    ><NewFileIcon /></Button>
  );
}

function SyncButton() {
  const { actions } = useApp();
  const [tip, setTip] = useState('Re-scan disk for external changes');
  // Decoupled from `state.syncRunning` so the icon keeps spinning for
  // a guaranteed minimum even when the sync request resolves in <100ms
  // (small / already-indexed folders). Without this the click felt
  // like nothing happened.
  const [spinning, setSpinning] = useState(false);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (tipTimer.current) clearTimeout(tipTimer.current); }, []);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={'text-muted-foreground' + (spinning ? ' [&_svg]:animate-spin [&_svg]:[animation-duration:700ms]' : '')}
      title={spinning ? 'Syncing…' : tip}
      disabled={spinning}
      onClick={async () => {
        setSpinning(true);
        setTip('Syncing…');
        const minSpin = new Promise((r) => setTimeout(r, 600));
        let ok = true;
        try {
          await Promise.all([actions.runSync(), minSpin]);
        } catch {
          ok = false;
          await minSpin;
        }
        setSpinning(false);
        setTip(ok ? 'Synced' : 'Sync failed');
        if (tipTimer.current) clearTimeout(tipTimer.current);
        tipTimer.current = setTimeout(
          () => setTip('Re-scan disk for external changes'),
          3000,
        );
      }}
    ><SyncIcon /></Button>
  );
}

/** Toggle button: collapse-all when anything is open, expand-all when
 *  everything's already folded. Mirrors VSCode's explorer toolbar
 *  button so a single click always does the "obvious" thing for the
 *  current state. */
function FolderFoldToggle() {
  const { state, dispatch } = useApp();
  const allCollapsed = state.expanded.size === 0;
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground"
      title={allCollapsed ? 'Expand all folders' : 'Collapse all folders'}
      onClick={() => {
        if (allCollapsed) {
          dispatch({
            type: 'EXPAND_ALL_FOLDERS',
            paths: state.folders.map((f) => f.path),
          });
        } else {
          dispatch({ type: 'COLLAPSE_ALL_FOLDERS' });
        }
      }}
    >{allCollapsed ? <ExpandAllIcon /> : <CollapseAllIcon />}</Button>
  );
}
