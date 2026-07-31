import { useEffect, useMemo, useRef, useState } from 'react';
import { commandDefinitions, rankCommandPalette, routeQuickAccess } from '../commandPalette';
import { rankQuickOpen } from '../quickOpen';
import { openSettings } from './SettingsModal';
import { useApp } from '../store/AppContext';

/** Quick Open calls the sidebar's document-selection action, preserving its
 * save guards, folder-generation checks, and preview-tab replacement. */
export function QuickOpen() {
  const { state, actions, activeTab } = useApp();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [settingsBlocking, setSettingsBlocking] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const blocked = Boolean(settingsBlocking || state.modal || state.cascadePrompt || state.ctxMenu || state.renaming);
  const paths = useMemo(() => state.files.map((file) => file.name), [state.files]);
  const recentPaths = state.recentFilePaths;
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>([]);
  const route = routeQuickAccess(query);
  const commandContext = {
    hasFolder: Boolean(state.folder && !state.welcomeVisible),
    hasActiveTab: Boolean(state.activeTabId),
    activeFileIsMarkdown: activeTab?.file?.format === 'md',
  };
  const fileItems = useMemo(
    () => rankQuickOpen(paths, route.provider === 'files' ? route.query : '', recentPaths),
    [paths, recentPaths, route.provider, route.query],
  );
  const commands = useMemo(
    () => rankCommandPalette(commandDefinitions.filter((command) => command.available(commandContext)), route.query, recentCommandIds),
    [commandContext.activeFileIsMarkdown, commandContext.hasActiveTab, commandContext.hasFolder, recentCommandIds, route.query],
  );
  const itemCount = route.provider === 'files' ? fileItems.length : route.provider === 'commands' ? commands.length : 0;
  const close = () => { setOpen(false); setQuery(''); setActive(0); requestAnimationFrame(() => restoreRef.current?.focus()); };
  const accept = (path: string) => { close(); void actions.selectFile(path); };
  const runCommand = (id: string) => {
    setRecentCommandIds((recent) => [id, ...recent.filter((candidate) => candidate !== id)]);
    close();
    switch (id) {
      case 'navigation.go-home': void actions.goHome(); break;
      case 'document.new-note': void actions.newNote(); break;
      case 'document.save': void actions.flushSave(); break;
      case 'document.close-editor': void actions.closeActiveTab(); break;
      case 'document.toggle-editing': void actions.toggleEditMode(); break;
      case 'document.find': actions.openFind(); break;
      case 'search.focus': actions.focusSearch(); break;
      case 'agent.show-claude': actions.openAgent('claude'); break;
      case 'agent.show-codex': actions.openAgent('codex'); break;
      case 'settings.open': openSettings(); break;
    }
  };

  useEffect(() => {
    const onOpen = (event: Event) => {
      // Some blocking UI (notably Agent permission cards) owns local state
      // outside this reducer. Every blocking surface uses the shared modal
      // veil, so this final topmost check keeps the shortcut from escaping it.
      const mode = (event as CustomEvent<{ mode?: string }>).detail?.mode;
      const commandsOnly = mode === 'commands';
      if (blocked || document.querySelector('.modal-veil, .quick-open-blocking') || (!commandsOnly && (state.welcomeVisible || !state.folder))) return;
      restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setQuery(commandsOnly ? '>' : ''); setActive(0); setOpen(true);
    };
    window.addEventListener('stashbase-open-quick-open', onOpen);
    return () => window.removeEventListener('stashbase-open-quick-open', onOpen);
  }, [blocked, state.folder, state.welcomeVisible]);
  useEffect(() => {
    const onBlocking = (event: Event) => setSettingsBlocking((event as CustomEvent<boolean>).detail === true);
    window.addEventListener('stashbase-overlay-blocking', onBlocking);
    return () => window.removeEventListener('stashbase-overlay-blocking', onBlocking);
  }, []);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { if (active >= itemCount) setActive(Math.max(0, itemCount - 1)); }, [active, itemCount]);
  if (!open) return null;
  return <div className="quick-open-veil" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className="quick-open" role="dialog" aria-label={route.provider === 'commands' ? 'Command Palette' : 'Quick Open'}>
      <input ref={inputRef} className="quick-open-input" role="combobox" aria-autocomplete="list" aria-controls="quick-open-results" aria-expanded="true" aria-activedescendant={itemCount ? `quick-open-${active}` : undefined} placeholder={route.provider === 'commands' ? 'Type a command' : 'Search files by name or path'} value={query}
        onChange={(event) => { setQuery(event.target.value); setActive(0); }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
          else if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => Math.min(index + 1, itemCount - 1)); }
          else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
          else if (event.key === 'Home') { event.preventDefault(); setActive(0); }
          else if (event.key === 'End') { event.preventDefault(); setActive(Math.max(0, itemCount - 1)); }
          else if (event.key === 'Enter' && route.provider === 'files' && fileItems[active]) { event.preventDefault(); accept(fileItems[active].path); }
          else if (event.key === 'Enter' && route.provider === 'commands' && commands[active]) { event.preventDefault(); runCommand(commands[active].id); }
        }} />
      <div className="quick-open-label">{route.provider === 'files' ? (route.query.trim() ? 'Files' : 'Recent editors') : route.provider === 'commands' ? 'Commands' : 'Quick Access'}</div>
      <ul id="quick-open-results" className="quick-open-results" role="listbox" aria-label="Quick Open results">
        {route.provider === 'files' && fileItems.map((item, index) => <li key={item.path} id={`quick-open-${index}`} role="option" aria-selected={index === active} className={index === active ? 'active' : ''} onMouseMove={() => setActive(index)} onMouseDown={(event) => { event.preventDefault(); accept(item.path); }}><span>{item.basename}</span><small>{item.path.includes('/') ? item.path.slice(0, item.path.lastIndexOf('/')) : 'Active Library'}</small></li>)}
        {route.provider === 'files' && fileItems.length === 0 && <li className="quick-open-empty" role="option" aria-disabled="true">{route.query.trim() ? 'No matching source files' : 'No recently used editors'}</li>}
        {route.provider === 'commands' && commands.map((command, index) => <li key={command.id} id={`quick-open-${index}`} role="option" aria-selected={index === active} className={index === active ? 'active' : ''} onMouseMove={() => setActive(index)} onMouseDown={(event) => { event.preventDefault(); runCommand(command.id); }}><span>{command.label}</span><small>{command.shortcut ?? command.category}</small></li>)}
        {route.provider === 'commands' && commands.length === 0 && <li className="quick-open-empty" role="option" aria-disabled="true">No matching available commands</li>}
      </ul>
      {route.provider === 'help' && <div className="quick-open-help" role="note">Type a file name to open a source file, or <kbd>&gt;</kbd> to run a command. Cmd/Ctrl+Shift+P and F1 open commands directly.</div>}
    </div>
  </div>;
}
