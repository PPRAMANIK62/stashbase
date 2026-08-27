import { useEffect, useMemo, useRef, useState } from 'react';
import { commandDefinitions, rankCommandPalette, routeQuickAccess } from '@/features/search/lib/commandPalette';
import { rankQuickOpen } from '@/common/lib/quickOpen';
import { useFocusTrap } from '@/common/hooks/useFocusTrap';
import { usePickerListNav } from '@/common/hooks/usePickerListNav';
import { useAppActions, useWorkspace } from '@/store/contexts/AppContext';
import { openLibrarySearch } from '@/common/lib/librarySearchTrigger';
import { openSettings } from '@/common/lib/settingsTrigger';
import {
  PICKER_LABEL_CLASS,
  PICKER_RESULTS_CLASS,
  PICKER_VEIL_CLASS,
  pickerPanelClass,
} from '@/common/lib/pickerChrome';
import { PickerEmptyRow, PickerRow } from '@/common/components/PickerRow';
import { cn } from '@/common/lib/utils';

let recentCommandIdsMemory: string[] = [];

/** Quick Open calls the sidebar's document-selection action, preserving its
 * save guards, folder-generation checks, and persistent-tab reuse. */
export default function ManagedQuickOpen({
  commandsOnly,
  onClose,
}: {
  commandsOnly: boolean;
  onClose: () => void;
}) {
  const state = useWorkspace();
  const { activeTab } = state;
  const { actions } = useAppActions();
  const [query, setQuery] = useState(commandsOnly ? '>' : '');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const paths = useMemo(() => state.files.map((file) => file.name), [state.files]);
  const fileByPath = useMemo(() => new Map(state.files.map((file) => [file.name, file])), [state.files]);
  const recentPaths = state.recentFilePaths;
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>(() => recentCommandIdsMemory);
  const route = routeQuickAccess(query);
  const commandContext = {
    hasFolder: Boolean(state.folder),
    hasActiveTab: Boolean(state.activeTabId),
    // Out-of-folder tabs are read-only — keep Toggle Editing off the palette.
    activeFileIsEditable: Boolean(activeTab?.file
      && (activeTab.file.format === 'md'
        || activeTab.file.format === 'json'
        || activeTab.file.format === 'text')
      && !activeTab.file.folder),
  };
  const fileItems = useMemo(
    () => rankQuickOpen(paths, route.provider === 'files' ? route.query : '', recentPaths),
    [paths, recentPaths, route.provider, route.query],
  );
  const commands = useMemo(
    () => rankCommandPalette(commandDefinitions.filter((command) => command.available(commandContext)), route.query, recentCommandIds),
    [commandContext.activeFileIsEditable, commandContext.hasActiveTab, commandContext.hasFolder, recentCommandIds, route.query],
  );
  const itemCount = route.provider === 'files' ? fileItems.length : route.provider === 'commands' ? commands.length : 0;
  const close = () => { setQuery(''); setActive(0); onClose(); };
  const accept = (path: string) => { close(); void actions.selectFile(path); };
  const runCommand = (id: string) => {
    setRecentCommandIds((recent) => {
      const next = [id, ...recent.filter((candidate) => candidate !== id)];
      recentCommandIdsMemory = next;
      return next;
    });
    close();
    switch (id) {
      case 'document.new-note': void actions.newNote(); break;
      case 'document.save': void actions.flushSave(); break;
      case 'document.close-editor': void actions.closeActiveTab(); break;
      case 'document.toggle-editing': void actions.toggleEditMode(); break;
      case 'document.find': actions.openFind(); break;
      // rAF: the palette veil is still in the DOM this tick (React hasn't
      // flushed the close yet) and the search opener refuses to stack on
      // an open picker — defer one frame so the handoff isn't swallowed.
      case 'search.open': requestAnimationFrame(() => openLibrarySearch()); break;
      case 'agent.show-claude': actions.openAgent('claude'); break;
      case 'agent.show-codex': actions.openAgent('codex'); break;
      case 'settings.open': openSettings(); break;
    }
  };
  const { active, setActive, onKeyDown } = usePickerListNav(itemCount, {
    onCancel: close,
    onAccept: (index) => {
      if (route.provider === 'files' && fileItems[index]) accept(fileItems[index].path);
      else if (route.provider === 'commands' && commands[index]) runCommand(commands[index].id);
    },
  });

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Makes `aria-modal` true rather than aspirational: Tab stays on the
  // query field and closing restores focus to whatever opened the palette.
  const panelRef = useFocusTrap<HTMLDivElement>();

  return <div className={cn('quick-open-veil', PICKER_VEIL_CLASS)} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div ref={panelRef} className={pickerPanelClass('wide')} role="dialog" aria-modal="true" aria-label={route.provider === 'commands' ? 'Command Palette' : 'Quick Open'}>
      {/* Deliberately NOT the `Input` primitive. `Input` is the box role —
        * its own fill, border, `rounded-lg` corner, and h-9 step — and the
        * palette query field is the opposite: a seam across the top of the
        * panel, which is itself the box. Converting would mean neutralising
        * six of the primitive's decisions and then suppressing all three of
        * its focus cues, because the panel is the focus affordance here and
        * its `overflow-hidden` corners clip a ring into a stray bar. See the
        * `.quick-open-veil input:focus-visible` rule in
        * `web-src/src/styles/globals.css`, which is unlayered precisely so it
        * beats the global focus outline. */}
      <input ref={inputRef} className="w-full border-0 border-b border-solid border-border bg-transparent px-3.5 py-3.5 [font-family:inherit] text-xl text-foreground outline-0 placeholder:text-placeholder" aria-label={route.provider === 'commands' ? 'Command Palette' : 'Quick Open'} role="combobox" aria-autocomplete="list" aria-controls="quick-open-results" aria-expanded="true" aria-activedescendant={itemCount ? `quick-open-${active}` : undefined} placeholder={route.provider === 'commands' ? 'Type a command' : 'Search files by name or path'} value={query}
        onChange={(event) => { setQuery(event.target.value); setActive(0); }}
        onKeyDown={onKeyDown} />
      <div className={PICKER_LABEL_CLASS}>{route.provider === 'files' ? (route.query.trim() ? 'Files' : 'Recent editors') : route.provider === 'commands' ? 'Commands' : 'Quick Access'}</div>
      <ul id="quick-open-results" className={PICKER_RESULTS_CLASS} role="listbox" aria-label="Quick Open results">
        {route.provider === 'files' && fileItems.map((item, index) => {
          const generic = fileByPath.get(item.path)?.format === 'generic';
          const folder = item.path.includes('/') ? item.path.slice(0, item.path.lastIndexOf('/')) : 'Active Library';
          return <PickerRow key={item.path} id={`quick-open-${index}`} selected={index === active} label={<span className={generic ? 'text-muted-foreground group-aria-selected:text-foreground' : undefined}>{item.basename}</span>} detail={folder} detailPrefix={generic ? 'Not in Search or Chat ·' : undefined} onHover={() => setActive(index)} onPick={() => accept(item.path)} />;
        })}
        {route.provider === 'files' && fileItems.length === 0 && <PickerEmptyRow>{route.query.trim() ? 'No matching files' : 'No recently used editors'}</PickerEmptyRow>}
        {route.provider === 'commands' && commands.map((command, index) => <PickerRow key={command.id} id={`quick-open-${index}`} selected={index === active} label={command.label} detail={command.shortcut ?? command.category} onHover={() => setActive(index)} onPick={() => runCommand(command.id)} />)}
        {route.provider === 'commands' && commands.length === 0 && <PickerEmptyRow>No matching available commands</PickerEmptyRow>}
      </ul>
      {route.provider === 'help' && <div className="px-2.5 py-3.5 leading-normal text-muted-foreground [&_kbd]:[font-family:inherit] [&_kbd]:font-semibold [&_kbd]:text-foreground" role="note">Type a file name to open a workspace file, or <kbd>&gt;</kbd> to run a command. Cmd/Ctrl+Shift+P and F1 open commands directly.</div>}
    </div>
  </div>;
}
