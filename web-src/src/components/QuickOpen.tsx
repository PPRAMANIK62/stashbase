import { useEffect, useMemo, useRef, useState } from 'react';
import { rankQuickOpen } from '../quickOpen';
import { useApp } from '../store/AppContext';

/** Quick Open calls the sidebar's document-selection action, preserving its
 * save guards, folder-generation checks, and preview-tab replacement. */
export function QuickOpen() {
  const { state, actions } = useApp();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [settingsBlocking, setSettingsBlocking] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const blocked = Boolean(settingsBlocking || state.modal || state.cascadePrompt || state.ctxMenu || state.renaming);
  const paths = useMemo(() => state.files.map((file) => file.name), [state.files]);
  const recentPaths = state.recentFilePaths;
  const items = useMemo(() => rankQuickOpen(paths, query, recentPaths), [paths, query, recentPaths]);
  const close = () => { setOpen(false); setQuery(''); setActive(0); requestAnimationFrame(() => restoreRef.current?.focus()); };
  const accept = (path: string) => { close(); void actions.selectFile(path); };

  useEffect(() => {
    const onOpen = () => {
      // Some blocking UI (notably Agent permission cards) owns local state
      // outside this reducer. Every blocking surface uses the shared modal
      // veil, so this final topmost check keeps the shortcut from escaping it.
      if (blocked || document.querySelector('.modal-veil, .quick-open-blocking') || state.welcomeVisible || !state.folder) return;
      restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setQuery(''); setActive(0); setOpen(true);
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
  useEffect(() => { if (active >= items.length) setActive(Math.max(0, items.length - 1)); }, [active, items.length]);
  if (!open) return null;
  return <div className="quick-open-veil" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className="quick-open" role="dialog" aria-label="Quick Open">
      <input ref={inputRef} className="quick-open-input" role="combobox" aria-autocomplete="list" aria-controls="quick-open-results" aria-expanded="true" aria-activedescendant={items[active] ? `quick-open-${active}` : undefined} placeholder="Search files by name or path" value={query}
        onChange={(event) => { setQuery(event.target.value); setActive(0); }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
          else if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => Math.min(index + 1, items.length - 1)); }
          else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
          else if (event.key === 'Home') { event.preventDefault(); setActive(0); }
          else if (event.key === 'End') { event.preventDefault(); setActive(Math.max(0, items.length - 1)); }
          else if (event.key === 'Enter' && items[active]) { event.preventDefault(); accept(items[active].path); }
        }} />
      <div className="quick-open-label">{query.trim() ? 'Files' : 'Recent editors'}</div>
      <ul id="quick-open-results" className="quick-open-results" role="listbox" aria-label="Quick Open results">
        {items.map((item, index) => <li key={item.path} id={`quick-open-${index}`} role="option" aria-selected={index === active} className={index === active ? 'active' : ''} onMouseMove={() => setActive(index)} onMouseDown={(event) => { event.preventDefault(); accept(item.path); }}><span>{item.basename}</span><small>{item.path.includes('/') ? item.path.slice(0, item.path.lastIndexOf('/')) : 'Active Library'}</small></li>)}
        {items.length === 0 && <li className="quick-open-empty" role="option" aria-disabled="true">{query.trim() ? 'No matching source files' : 'No recently used editors'}</li>}
      </ul>
    </div>
  </div>;
}
