import { useEffect, useMemo, useRef, useState } from 'react';
import { rankQuickOpen } from '@/common/lib/quickOpen';
import { usePickerListNav } from '@/common/hooks/usePickerListNav';
import { useWorkspace } from '@/store/contexts/AppContext';
import {
  PICKER_LABEL_CLASS,
  PICKER_RESULTS_CLASS,
  PICKER_VEIL_CLASS,
  pickerPanelClass,
} from '@/common/lib/pickerChrome';
import { PickerEmptyRow, PickerRow } from '@/common/components/PickerRow';
import { cn } from '@/common/lib/utils';

/**
 * Body of the "Link to file…" slash-menu picker. Lists the active folder's
 * library files — the same set backing Quick Open, since a per-folder file
 * listing is only ever available for the active folder — fuzzy-ranked with
 * Quick Open's own scorer as the user types, and reports the chosen path
 * back to the slash-menu item that opened it.
 */
export default function ManagedLinkFilePicker({
  onSelect,
  onCancel,
}: {
  onSelect: (path: string) => void;
  onCancel: () => void;
}) {
  const state = useWorkspace();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const paths = useMemo(() => state.files.map((file) => file.name), [state.files]);
  const items = useMemo(
    () => rankQuickOpen(paths, query, state.recentFilePaths),
    [paths, query, state.recentFilePaths],
  );
  const { active, setActive, onKeyDown } = usePickerListNav(items.length, {
    onCancel,
    onAccept: (index) => onSelect(items[index].path),
  });

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div
      className={cn('link-file-picker-veil quick-open-blocking', PICKER_VEIL_CLASS)}
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <div className={pickerPanelClass('wide')} role="dialog" aria-label="Link to file">
        {/* Deliberately NOT the `Input` primitive — the same palette-field
          * exemption as Quick Open and library search: `Input` is the box
          * role, and this is a seam across a panel that is itself the box
          * and the focus affordance. `.link-file-picker-veil` is listed
          * alongside the other two palette veils in the focus-suppression
          * rule in `web-src/src/styles/globals.css`, so the panel's
          * `overflow-hidden` corners never clip the ring into a stray bar. */}
        <input
          ref={inputRef}
          className="w-full border-0 border-b border-solid border-border bg-transparent px-3.5 py-3.5 [font-family:inherit] text-xl text-foreground outline-0 placeholder:text-placeholder"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="link-file-picker-results"
          aria-expanded="true"
          aria-activedescendant={items.length ? `link-file-picker-${active}` : undefined}
          placeholder="Search files to link"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
        />
        <div className={PICKER_LABEL_CLASS}>{query.trim() ? 'Files' : 'Recent editors'}</div>
        <ul id="link-file-picker-results" className={PICKER_RESULTS_CLASS} role="listbox" aria-label="Link to file results">
          {items.map((item, index) => (
            <PickerRow
              key={item.path}
              id={`link-file-picker-${index}`}
              selected={index === active}
              label={item.basename}
              detail={item.path.includes('/') ? item.path.slice(0, item.path.lastIndexOf('/')) : 'Active Library'}
              onHover={() => setActive(index)}
              onPick={() => onSelect(item.path)}
            />
          ))}
          {items.length === 0 && (
            <PickerEmptyRow>
              {query.trim() ? 'No matching files' : 'No files to link yet'}
            </PickerEmptyRow>
          )}
        </ul>
      </div>
    </div>
  );
}
