import { useId } from 'react';

import { FolderIcon, LibraryIcon } from '@/common/components/icons';
import { cn } from '@/common/lib/utils';
import {
  Menu,
  MenuPopup,
  MenuPortal,
  MenuPositioner,
  MenuTrigger,
} from '@/common/components/ui/menu';
import { MenuOption } from '@/common/components/ui/menu-option';
import { MenuSectionLabel } from '@/common/components/ui/menu-radio';
import { Pill } from '@/common/components/ui/pill';
import { basename, shortenFolderPath } from '@/common/lib/paths';
import {
  folderScope,
  LIBRARY_SCOPE,
  scopeDisplayName,
  type LibraryFolderOption,
  type LibraryScope,
} from '@/common/lib/libraryScope';

/**
 * The app's ONE scope picker: the whole Library, or one library folder.
 * Both surfaces that pick a scope share it — the chat composer (which
 * scope a new session binds) and the search popup (which folder a search
 * covers) — so the two read as the same control with the same rows,
 * ordering, and states rather than two lookalikes that drift.
 *
 * Callers vary only the copy (`heading`, `libraryDetail`), the side the
 * popup opens toward, and whether the trigger is locked (the composer
 * locks it once a conversation has content — a chat never rebinds).
 */
export function ScopeMenu({
  scope,
  entries,
  homeDir,
  heading,
  libraryDetail,
  side = 'top',
  ariaLabel,
  locked = false,
  disabled = false,
  triggerClassName,
  onSetScope,
}: {
  scope: LibraryScope;
  entries: LibraryFolderOption[];
  homeDir: string;
  /** Menu title, e.g. "Session scope" / "Search scope". */
  heading: string;
  /** Second line on the Library row, e.g. "Search every folder". */
  libraryDetail: string;
  side?: 'top' | 'bottom';
  ariaLabel?: string;
  locked?: boolean;
  disabled?: boolean;
  triggerClassName?: string;
  onSetScope: (scope: LibraryScope) => void;
}) {
  const headingId = useId();
  const isLibrary = scope.kind === 'library';
  return (
    <Menu>
      <MenuTrigger
        render={<Pill locked={locked} className={cn('max-w-40', triggerClassName)} />}
        disabled={disabled || locked}
        aria-label={ariaLabel ?? heading}
        title={isLibrary
          ? `${heading} — the whole library`
          : `${heading} — ${shortenFolderPath(scope.path, homeDir)}`}
      >
        {scopeDisplayName(scope)}
      </MenuTrigger>
      <MenuPortal>
        <MenuPositioner side={side} align="start" sideOffset={6} collisionPadding={8}>
          {/* `w-overlay-md` is the menu step (the rows carry a folder name
            * over its shortened path, so this is a dialog-column measure,
            * not an anchored strip). It replaces a hand-typed `w-85` plus
            * its own `calc(100vw-24px)` clamp — a fourth spelling of the
            * 16px-a-side margin every other floating surface gets free
            * from `--overlay-fit`, and 4px tighter than all of them. */}
          {/* The popup is named BY its own visible title rather than by a
            * second copy of the same string in an `aria-label`: one label
            * doing both jobs cannot drift out of step with the text beside
            * it. The trigger keeps its `aria-label` — its visible text is
            * the current scope, not the question. */}
          <MenuPopup className="max-h-overlay-sm w-overlay-md overflow-auto p-1.5" aria-labelledby={headingId}>
            <div className="flex flex-col items-start gap-0.5 px-2 pt-1 pb-2 text-sm">
              <span id={headingId} className="font-semibold text-foreground">{heading}</span>
            </div>
            <MenuOption
              label="Library"
              active={isLibrary}
              icon={LibraryIcon}
              title="Library"
              description={libraryDetail}
              onClick={() => onSetScope(LIBRARY_SCOPE)}
            />
            {entries.length > 0 && <MenuSectionLabel>Folders</MenuSectionLabel>}
            {entries.map((entry) => (
              <MenuOption
                key={entry.path}
                label={basename(entry.path)}
                active={scope.kind === 'folder' && scope.path === entry.path}
                icon={FolderIcon}
                title={basename(entry.path)}
                description={shortenFolderPath(entry.path, homeDir)}
                onClick={() => onSetScope(folderScope(entry.path))}
              />
            ))}
          </MenuPopup>
        </MenuPositioner>
      </MenuPortal>
    </Menu>
  );
}
