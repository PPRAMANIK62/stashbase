import { useEffect, useMemo, useRef, useState } from 'react';
import { usePickerListNav } from '@/common/hooks/usePickerListNav';
import { useWorkspace } from '@/store/contexts/AppContext';
import {
  PICKER_LABEL_CLASS,
  PICKER_RESULTS_CLASS,
  PICKER_VEIL_CLASS,
  pickerPanelClass,
} from '@/common/lib/pickerChrome';
import { PickerEmptyRow, PickerRow } from '@/common/components/PickerRow';
import { basename } from '@/common/lib/paths';
import { cn } from '@/common/lib/utils';

/** Where `path` currently lives (`''` = the folder root). */
function parentOf(path: string): string {
  const cut = path.lastIndexOf('/');
  return cut < 0 ? '' : path.slice(0, cut);
}

/**
 * Body of the file row's "Move to…" picker — the keyboard-reachable
 * equivalent of dragging the row onto a folder (or onto the sidebar
 * header for the root). Lists the active folder's root plus every inner
 * folder except the file's current home, and resolves through the same
 * `actions.moveFile` the drop path calls (the gate owns that call).
 *
 * Follows the topmost-picker idiom (Quick Open / Link to file): a
 * labelled dialog panel whose combobox input holds focus for the
 * picker's whole life — Tab is swallowed so focus cannot slip behind the
 * veil (the panel deliberately does NOT claim `aria-modal` it can't
 * enforce), Escape cancels, and dismissal returns focus to the tree.
 */
export default function ManagedMoveFilePicker({
  filePath,
  onPick,
  onCancel,
}: {
  /** Folder-relative path of the file being moved. */
  filePath: string;
  /** Called with the destination directory (`''` = folder root). */
  onPick: (targetDir: string) => void;
  onCancel: () => void;
}) {
  const state = useWorkspace();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const currentDir = parentOf(filePath);
  const items = useMemo(() => {
    const destinations = [
      { dir: '', label: state.folder || 'Folder root', detail: 'Folder root' },
      ...state.folders.map((folder) => ({
        dir: folder.path,
        label: basename(folder.path),
        detail: folder.path,
      })),
    ].filter((destination) => destination.dir !== currentDir);
    const needle = query.trim().toLowerCase();
    if (!needle) return destinations;
    return destinations.filter((destination) =>
      destination.label.toLowerCase().includes(needle)
      || destination.detail.toLowerCase().includes(needle));
  }, [state.folder, state.folders, currentDir, query]);

  const { active, setActive, onKeyDown } = usePickerListNav(items.length, {
    onCancel,
    onAccept: (index) => onPick(items[index].dir),
  });

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div
      className={cn('move-file-picker-veil quick-open-blocking', PICKER_VEIL_CLASS)}
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <div className={pickerPanelClass('wide')} role="dialog" aria-label={`Move ${basename(filePath)} to folder`}>
        {/* Same palette-field exemption as Quick Open / Link to file —
          * the panel is the box, the input is a seam across it. */}
        <input
          ref={inputRef}
          className="w-full border-0 border-b border-solid border-border bg-transparent px-3.5 py-3.5 [font-family:inherit] text-xl text-foreground outline-0 placeholder:text-placeholder"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="move-file-picker-results"
          aria-expanded="true"
          aria-activedescendant={items.length ? `move-file-picker-${active}` : undefined}
          placeholder="Move to folder"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={(event) => {
            // The input is the picker's only tab stop; letting Tab out
            // would land focus behind the veil with the picker still up.
            if (event.key === 'Tab') { event.preventDefault(); return; }
            onKeyDown(event);
          }}
        />
        <div className={PICKER_LABEL_CLASS}>Folders</div>
        <ul id="move-file-picker-results" className={PICKER_RESULTS_CLASS} role="listbox" aria-label="Destination folders">
          {items.map((item, index) => (
            <PickerRow
              key={item.dir || '/'}
              id={`move-file-picker-${index}`}
              selected={index === active}
              label={item.label}
              detail={item.detail}
              onHover={() => setActive(index)}
              onPick={() => onPick(item.dir)}
            />
          ))}
          {items.length === 0 && (
            <PickerEmptyRow>
              {query.trim() ? 'No matching folders' : 'No other folder to move to'}
            </PickerEmptyRow>
          )}
        </ul>
      </div>
    </div>
  );
}
