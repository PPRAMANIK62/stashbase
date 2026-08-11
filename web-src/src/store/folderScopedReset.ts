/**
 * Pure dispatch plan for clearing folder-scoped renderer state when the
 * window's folder context changes.
 *
 * Two distinct transitions share most of the plan:
 *
 * - `'switch'` — the window navigates to another library folder (sidebar
 *   root click, Open Folder…). Document tabs and preparation state belong
 *   to the old folder and reset. Search does NOT: the search popup is
 *   library-scoped and keeps its state outside the reducer
 *   (`librarySearch.ts`), precisely so its own cross-folder result-opens
 *   cannot wipe it. Chat tabs do NOT either: every
 *   agent session is pinned server-side to an explicit member folder, so
 *   the tabs and their running sessions survive the switch. Bound tabs
 *   keep their binding (the pane header marks cross-folder chats);
 *   unbound empty tabs follow the new window folder on their next
 *   connect.
 * - `'folder-lost'` — the window loses its folder context entirely
 *   (library removal, another window closing the folder). Chat tabs
 *   reset too: the server ends the affected sessions, and panels must
 *   not keep rendering against a folder that is gone.
 */
import type { Action } from './state';

export type FolderResetReason = 'switch' | 'folder-lost';

export function folderScopedResetActions(reason: FolderResetReason): Action[] {
  return [
    { type: 'TABS_RESET' },
    ...(reason === 'folder-lost' ? [{ type: 'CHAT_TABS_RESET' } as Action] : []),
    { type: 'ACTIVE_FOLDER', path: '' },
    { type: 'PENDING_SEMANTIC_NAMES', names: new Set() },
    { type: 'PENDING_CONVERSIONS', paths: [] },
    { type: 'BLOCKED_CONVERSIONS', paths: [] },
    { type: 'CONVERSION_PROGRESS', progress: {} },
    { type: 'CONVERSION_SCHEDULER_STATE', revision: 0, versions: {} },
    { type: 'INDEX_WARNING', warning: null },
    { type: 'PREPARATION_FAILURES', failures: [] },
    { type: 'SYNC_RUNNING', running: false },
    { type: 'FILE_ORDER_LOADED', order: {} },
  ];
}
