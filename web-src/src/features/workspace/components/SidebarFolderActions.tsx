import { electronBridge } from '@/common/lib/electronBridge';
import { FolderIcon, NewFolderIcon } from '@/common/components/icons';
import { Button } from '@/common/components/ui/button';
import { folderPickerFlows } from '@/features/workspace/lib/addFolderMenu';
import { useAppActions } from '@/store/contexts/AppContext';

/**
 * The bare window's folder zone in the sidebar: the TWO core add-folder
 * flows as quiet command rows — the same flows the titlebar switcher
 * menu serves (`folderPickerFlows`), so the two surfaces cannot drift.
 *
 * Deliberately minimal. No membership list (a long library reads as
 * clutter in a launcher — browsing members belongs to the Library
 * switcher), no scope explainer, and no GitHub import row (a niche flow
 * the switcher menu keeps): the column answers "how do I get a folder
 * open" with the fewest rows that can.
 *
 * Rows wear the New Chat anatomy — min-h-7 ghost rows, a 16px leading
 * slot around a 14px glyph — so the whole launcher column reads as one
 * family.
 */
export function SidebarFolderActions() {
  const { actions } = useAppActions();
  const flows = folderPickerFlows(actions, electronBridge());
  if (!flows) return null;

  const rowClass =
    'h-auto min-h-7 w-full min-w-0 justify-start gap-2 px-2 text-left text-base font-normal text-muted-foreground hover:text-foreground';

  return (
    <div className="flex flex-col px-1.5 pb-3">
      <Button variant="ghost" size="sm" className={rowClass} onClick={() => { void flows.openExistingFolder(); }}>
        <span className="inline-flex size-4 flex-none items-center justify-center"><FolderIcon className="size-3.5" /></span>
        <span className="min-w-0 truncate">Open Folder…</span>
      </Button>
      <Button variant="ghost" size="sm" className={rowClass} onClick={() => { void flows.newFolderFromHome(); }}>
        <span className="inline-flex size-4 flex-none items-center justify-center"><NewFolderIcon className="size-3.5" /></span>
        <span className="min-w-0 truncate">New Folder…</span>
      </Button>
    </div>
  );
}
