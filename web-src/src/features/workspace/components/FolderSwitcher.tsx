import { useMemo, useRef, useState } from 'react';
import { api, errorMessage } from '@/common/api/api';
import { electronBridge } from '@/common/lib/electronBridge';
import { folderRefsEqual } from '@/features/workspace/lib/folderPath';
import { ChevronDownIcon, FolderIcon, NewFolderIcon } from '@/common/components/icons';
import { basename, shortenFolderPath } from '@/common/lib/paths';
import { useAppActions, useWorkspace } from '@/store/AppContext';
import { refreshLibraryMembership, useLibraryMembership } from '@/features/workspace/hooks/useLibraryMembership';
import { useOpenFolderWatchdog } from '@/features/workspace/hooks/useOpenFolderWatchdog';
import { Menu, type MenuItem } from '@/common/components/Menu';
import type { LibraryListEntry } from '@/features/workspace/lib/libraryListPlan';

/** The two add-folder flows shared by the switcher (and the zero-folder
 *  hero button, which keeps its own copy of the first). "Open Folder…"
 *  picks any folder on disk and opens it in place (nothing is copied; it
 *  is indexed where it lives). "New Folder…" opens the same native picker
 *  at the default StashBase home so the OS panel's New Folder button
 *  lands in the expected place. Browser mode (no Electron bridge) has no
 *  portable absolute-path picker, so the list is empty. */
export function addFolderMenuItems(
  actions: ReturnType<typeof useAppActions>['actions'],
  bridge: ReturnType<typeof electronBridge>,
): MenuItem[] {
  if (typeof bridge?.openFolderDialog !== 'function') return [];

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

  return [
    {
      label: 'Open Folder…',
      icon: <FolderIcon />,
      detail: 'Any folder on your disk, indexed in place',
      onSelect: () => { void openExistingFolder(); },
    },
    {
      label: 'New Folder…',
      icon: <NewFolderIcon />,
      detail: 'Created under the StashBase folder home',
      onSelect: () => { void newFolderFromHome(); },
    },
  ];
}

/**
 * Titlebar folder switcher — the ONE home for moving between library
 * folders (Trae/VS Code workspace-switcher register, placed right of the
 * search control). The trigger carries the window's folder identity
 * ("design-docs ⌄", or "Library ⌄" with no folder open), so the identity
 * survives a sidebar collapse; the menu lists the add-folder actions on
 * top and the whole membership below (favorites first, current checked,
 * needs-attention members carrying the quiet warning dot).
 */
export function FolderSwitcher() {
  const state = useWorkspace();
  const { actions, dispatch } = useAppActions();
  const bridge = electronBridge();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [openingFolder, setOpeningFolder] = useState<{ path: string; name: string } | null>(null);
  const openingRequestRef = useRef(0);

  const activePath = state.folderPath;
  const isCurrent = (path: string) => !!activePath && folderRefsEqual(path, activePath);

  useOpenFolderWatchdog(openingFolder, (opening) => {
    setOpeningFolder(null);
    actions.toast(
      `Opening ${opening.name} is taking longer than expected. Please try again.`,
      { level: 'error' },
    );
  });

  // Membership can change without this window acting (another window, an
  // MCP client); poll only while the menu is up, so the open list stays
  // honest without a standing background loop.
  useLibraryMembership(anchor !== null, state.recent, dispatch);

  function openFolder(path: string) {
    if (isCurrent(path)) return;
    const requestId = ++openingRequestRef.current;
    setOpeningFolder({ path, name: basename(path) });
    void actions.openFolder(path)
      .catch((e) => {
        if (requestId !== openingRequestRef.current) return;
        actions.toast(errorMessage(e), { level: 'error' });
        // Remove the failed entry immediately so a stale/deleted path
        // doesn't remain clickable if the server refresh also fails.
        dispatch({
          type: 'RECENT_LOADED',
          recent: state.recent.filter((r) => r.path !== path),
          homeDir: state.homeDir,
        });
        void refreshLibraryMembership(dispatch)
          .catch(() => { /* keep the optimistic removal */ });
      })
      .finally(() => {
        if (requestId === openingRequestRef.current) setOpeningFolder(null);
      });
  }

  const items = useMemo<{ pinned: MenuItem[]; list: MenuItem[] }>(() => {
    const add = addFolderMenuItems(actions, bridge);
    const row = (entry: LibraryListEntry): MenuItem => ({
      label: basename(entry.path),
      icon: <FolderIcon />,
      detail: shortenFolderPath(entry.path, state.homeDir ?? ''),
      checked: isCurrent(entry.path),
      attention: state.libraryFolderStatuses[entry.path] === 'failed',
      onSelect: () => {
        setAnchor(null);
        openFolder(entry.path);
      },
    });
    const favorites = state.recent.filter((entry) => entry.favorite);
    const rest = state.recent.filter((entry) => !entry.favorite);
    /* "Library", not "Recent": the group is the WHOLE membership in
     * recents order — a Recent label would imply an unlisted remainder.
     * The add actions (plus the one hairline) ride `pinned` so they stay
     * put while a long membership scrolls; group headings stay quiet
     * labels with no extra hairlines (the pill menus' grouping rule). */
    return {
      pinned: [
        ...add,
        ...(add.length > 0 && state.recent.length > 0 ? [{ separator: true } as MenuItem] : []),
      ],
      list: [
        ...(favorites.length > 0 ? [{ heading: 'Favorites' } as MenuItem, ...favorites.map(row)] : []),
        ...(rest.length > 0 ? [{ heading: 'Library' } as MenuItem, ...rest.map(row)] : []),
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openFolder/isCurrent are stable per render inputs below
  }, [actions, bridge, activePath, state.homeDir, state.libraryFolderStatuses, state.recent]);

  const label = openingFolder
    ? `Opening ${openingFolder.name}…`
    : activePath
      ? basename(activePath)
      : 'Library';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        /* Regular weight on the quiet titlebar — medium next to the muted
         * icon cluster read heavy; identity is carried by being the only
         * TEXT in the band. Separation from the search icon comes from
         * the cluster's hairline (TitlebarControls), not a margin here.
         * Explicit no-drag: the band doubles as the window drag region,
         * and the global button carve-out must not be this control's
         * only cover. */
        className="flex h-7 min-w-0 cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-1.5 text-base text-foreground hover:bg-muted aria-expanded:bg-active disabled:cursor-default disabled:opacity-60 [-webkit-app-region:no-drag]"
        aria-label="Switch folder"
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        title={activePath ?? 'Library'}
        disabled={openingFolder !== null}
        onClick={() => {
          const rect = triggerRef.current?.getBoundingClientRect();
          if (rect) setAnchor((prev) => (prev ? null : rect));
        }}
      >
        <span className="max-w-44 truncate">{label}</span>
        <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground" />
      </button>
      {anchor && (
        <Menu
          anchor={{ rect: anchor, align: 'left' }}
          minWidth={260}
          pinnedItems={items.pinned}
          items={items.list}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
}
