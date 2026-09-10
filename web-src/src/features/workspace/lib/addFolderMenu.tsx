import { api, errorMessage } from '@/common/api/api';
import { electronBridge } from '@/common/lib/electronBridge';
import { FolderIcon, GithubLogoIcon, NewFolderIcon } from '@/common/components/icons';
import type { useAppActions } from '@/store/contexts/AppContext';
import type { MenuItem } from '@/common/components/Menu';

/** The two native-picker flows behind "Open Folder…" and "New Folder…",
 *  shared by the switcher menu and the main pane's welcome landing — ONE
 *  implementation so the two surfaces cannot drift. Null when the host
 *  has no folder dialog (the browser dev shell). "Open Folder…" picks any
 *  folder on disk and opens it in place (nothing is copied; it is indexed
 *  where it lives). "New Folder…" opens the same native picker at the
 *  default StashBase home so the OS panel's New Folder button lands in
 *  the expected place. */
export function folderPickerFlows(
  actions: ReturnType<typeof useAppActions>['actions'],
  bridge: ReturnType<typeof electronBridge>,
): { openExistingFolder: () => Promise<void>; newFolderFromHome: () => Promise<void> } | null {
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

  return { openExistingFolder, newFolderFromHome };
}

/** The add-folder flows as menu rows, for the switcher. "Import from
 *  GitHub…" opens the in-app repository import modal to clone into
 *  folder home. */
export function addFolderMenuItems(
  actions: ReturnType<typeof useAppActions>['actions'],
  bridge: ReturnType<typeof electronBridge>,
  opts?: { onImportGitHub?: () => void },
): MenuItem[] {
  const items: MenuItem[] = [];
  const flows = folderPickerFlows(actions, bridge);

  if (flows) {
    items.push(
      {
        label: 'Open Folder…',
        icon: <FolderIcon />,
        detail: 'Any folder on your disk, indexed in place',
        onSelect: () => { void flows.openExistingFolder(); },
      },
      {
        label: 'New Folder…',
        icon: <NewFolderIcon />,
        detail: 'Created under the StashBase folder home',
        onSelect: () => { void flows.newFolderFromHome(); },
      },
    );
  }

  if (opts?.onImportGitHub) {
    items.push({
      label: 'Import from GitHub…',
      icon: <GithubLogoIcon />,
      detail: 'Clone a public repository into your StashBase folder home',
      onSelect: () => { opts.onImportGitHub!(); },
    });
  }

  return items;
}

/**
 * Titlebar folder switcher — the standing home for moving between
 * library folders (Trae/VS Code workspace-switcher register, placed
 * right of the search control). The trigger carries the window's folder
 * identity ("design-docs ⌄", or "Library ⌄" with no folder open), so
 * the identity survives a sidebar collapse; the menu lists the
 * add-folder actions on top and the whole membership below (favorites
 * first, current checked, needs-attention members carrying the quiet
 * warning dot). The menu's content is built once in `libraryMenuItems` and is
 * shared with the active-folder header's Change Folder submenu.
 */
