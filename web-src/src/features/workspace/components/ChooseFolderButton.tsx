import { useState } from 'react';
import { errorMessage } from '@/common/api/api';
import { electronBridge } from '@/common/lib/electronBridge';
import { FolderIcon } from '@/common/components/icons';
import { Menu } from '@/common/components/Menu';
import { Button } from '@/common/components/ui/button';
import { ImportGitHubModal } from '@/features/workspace/components/ImportGitHubModal';
import { useAppActions, useWorkspace } from '@/store/contexts/AppContext';
import { useLibraryMembership } from '@/features/workspace/hooks/useLibraryMembership';
import { libraryMenuItems } from '@/features/workspace/lib/libraryMenuItems';

/** The populated-library twin of ZeroFolderState's invitation: members
 *  exist but none is open, so a New Chat-shaped action row invites
 *  right below New Chat — where a chat-first user is already looking —
 *  with the same menu the titlebar switcher serves (membership plus
 *  the add-folder flows). No open watchdog here: picking swaps this
 *  sidebar for the folder tree, which is its own feedback; slow or
 *  failed opens surface through the switcher's richer flow. */
export function ChooseFolderButton() {
  const state = useWorkspace();
  const { actions, dispatch } = useAppActions();
  const bridge = electronBridge();
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [importGitHubOpen, setImportGitHubOpen] = useState(false);

  // Same honesty rule as the switcher: membership can change without
  // this window acting; poll only while the menu is up.
  useLibraryMembership(anchor !== null, state.recent, dispatch);

  const items = libraryMenuItems({
    actions,
    bridge,
    entries: state.recent,
    homeDir: state.homeDir ?? '',
    attention: (path) => state.libraryFolderStatuses[path] === 'failed',
    isCurrent: () => false,
    onPick: (path) => {
      setAnchor(null);
      void actions.openFolder(path)
        .catch((e) => actions.toast(errorMessage(e), { level: 'error' }));
    },
    onImportGitHub: () => {
      setAnchor(null);
      setImportGitHubOpen(true);
    },
  });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        /* Same row anatomy as New Chat above it — px-2 pill row, 16px
         * icon slot around a 14px glyph, label on the shared 38px
         * gutter — so the two bare-window actions read as siblings.
         * Accent TEXT, not a solid fill: a standing invitation follows
         * the accent text-link rule; solid accent stays reserved for
         * transient offer cards. No chevron: in this chrome the chevron
         * marks a switchable current VALUE ("Library ⌄", the agent
         * picker) — this label is a command, and the verb already
         * promises the menu, as with Add Folder…. `size="sm"` IS the
         * 28px row this used to spell as `min-h-7`; the overrides below
         * are the sidebar-row deltas only (full width, left-aligned,
         * accent text, and the selected-surface open state a menu
         * anchor takes instead of the plain hover tint). */
        className="w-full justify-start gap-2 px-2 text-left text-base text-accent aria-expanded:bg-active aria-expanded:text-accent"
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setAnchor((prev) => (prev ? null : rect));
        }}
      >
        <span className="inline-flex size-4 flex-none items-center justify-center">
          <FolderIcon className="size-3.5" />
        </span>
        <span className="min-w-0 truncate">Choose Folder</span>
      </Button>
      {anchor && (
        <Menu
          anchor={{ rect: anchor, align: 'left' }}
          minWidth={260}
          pinnedItems={items.pinned}
          items={items.list}
          onClose={() => setAnchor(null)}
        />
      )}
      {importGitHubOpen && (
        <ImportGitHubModal onClose={() => setImportGitHubOpen(false)} />
      )}
    </>
  );
}
