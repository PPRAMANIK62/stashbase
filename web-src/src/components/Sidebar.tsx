import {
  ChevronDownIcon,
  CollapseAllIcon,
  ExpandAllIcon,
  LibraryIcon,
  NewFileIcon,
  NewFolderIcon,
  SearchIcon,
  SyncIcon,
} from '../icons';
import { useApp } from '../store/AppContext';
import { FileTree } from './FileTree';
import { ModalShell } from './ModalShell';
import { Outline } from './Outline';
import { api, errorMessage } from '../api';
import { useEffect, useRef, useState, type DragEvent } from 'react';

const FILE_MIME = 'application/x-stashbase-file';
interface ElectronBridge {
  openSpaceWindow?: (name: string) => Promise<boolean>;
}

/**
 * Left rail composition. Search box → space header (chevron + label +
 * 4 action buttons) → file tree → outline. The SPACE header doubles
 * as a drop target for "move to root" gestures (otherwise files in a
 * subfolder have no obvious way back up).
 */
export function Sidebar() {
  const { state, actions, dispatch } = useApp();
  const [sideHeadDrop, setSideHeadDrop] = useState(false);

  function onSideHeadDragOver(e: DragEvent<HTMLDivElement>) {
    if (!e.dataTransfer.types.includes('Files') && !e.dataTransfer.types.includes(FILE_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    setSideHeadDrop(true);
  }
  function onSideHeadDragLeave() { setSideHeadDrop(false); }
  function onSideHeadDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setSideHeadDrop(false);
    const internal = e.dataTransfer.getData(FILE_MIME);
    if (internal) {
      void actions.moveFile(internal, '');
    }
    // External imports are handled by the global drop listener which
    // computes its target from the cursor's `.tree-row.folder` /
    // `#sideHead` closest. We don't double-handle here.
  }

  const rootSelected = state.selectedPath === '';

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
  const libraryActive = activeTab?.file?.kind === 'library';

  return (
    <aside className="sidebar">
      <SearchBox />
      <div
        className={'library-row' + (libraryActive ? ' active' : '')}
        role="button"
        title="Open AGENT.md — the AI assistant's library overview"
        onClick={() => { void actions.openLibraryOverview(); }}
      >
        <LibraryIcon className="library-row-icon" />
        <span className="library-row-label">AGENT.md</span>
      </div>
      <div
        id="sideHead"
        className={
          'side-head'
          + (sideHeadDrop ? ' drop-target' : '')
          + (rootSelected ? ' active-root' : '')
        }
        onDragOver={onSideHeadDragOver}
        onDragLeave={onSideHeadDragLeave}
        onDrop={onSideHeadDrop}
      >
        <span className={'space-title' + (state.spaceCollapsed ? ' collapsed' : '')}>
          {/* Chevron alone toggles whole-space fold. Clicking the
              label selects "space root" so the next new-note / +folder
              lands at the top level — mirrors VSCode where the
              workspace header is itself a selectable container. */}
          <span
            className="space-chev"
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'SPACE_FOLD_TOGGLE' });
            }}
          ><ChevronDownIcon /></span>
          <span
            className="folder-label"
            title={state.space || 'notes'}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'ACTIVE_FOLDER', path: '' });
            }}
          >{(state.space || 'notes').toUpperCase()}</span>
        </span>
        <div className="side-actions">
          <SpaceMenu />
          <NewNoteButton />
          <button
            className="icon-btn"
            type="button"
            title={'New folder in ' + (state.activeFolder || (state.space || 'space root'))}
            onClick={() => {
              // Make sure the target parent is expanded so the inline
              // input appears in view; FileTree mounts it there.
              if (state.activeFolder) {
                dispatch({ type: 'EXPAND_FOLDER', path: state.activeFolder });
              }
              dispatch({ type: 'NEW_FOLDER_INPUT', open: true });
            }}
          ><NewFolderIcon /></button>
          <SyncButton />
          <FolderFoldToggle />
        </div>
      </div>
      <div className={'file-list' + (state.spaceCollapsed ? ' collapsed' : '')}>
        {state.pendingConversions.length > 0 && (
          <div className="pdf-processing-banner">
            {state.pendingConversions.map((p) => (
              <div key={p} className="pdf-processing-row" title={p}>
                <span className="pdf-processing-spinner" />
                <span className="pdf-processing-label">
                  Processing <strong>{p.split('/').pop()}</strong>…
                </span>
              </div>
            ))}
          </div>
        )}
        <FileTree />
      </div>
      <Outline />
    </aside>
  );
}

function SpaceMenu() {
  const { state, actions } = useApp();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<null | { kind: 'new' | 'rename' | 'switch'; name: string }>(null);
  const [spaces, setSpaces] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = state.space || '';

  async function loadSpaces() {
    try {
      const r = await api.listAvailableSpaces();
      setSpaces(r.names);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function openModal(kind: 'new' | 'rename' | 'switch') {
    setOpen(false);
    setError(null);
    if (kind === 'switch') void loadSpaces();
    setModal({ kind, name: kind === 'rename' ? current : '' });
  }

  async function submitName() {
    if (!modal) return;
    const name = modal.name.trim();
    if (!name) { setError('Name required'); return; }
    setBusy(true);
    setError(null);
    const prevSpaces = spaces;
    try {
      if (modal.kind === 'new') {
        setSpaces((currentSpaces) => currentSpaces.includes(name) ? currentSpaces : [...currentSpaces, name].sort());
        await actions.openSpaceByName(name);
      } else if (modal.kind === 'rename') {
        setSpaces((currentSpaces) => currentSpaces.map((v) => (v === current ? name : v)).sort());
        await api.renameSpace(current, name);
        await actions.openSpaceByName(name);
      } else {
        await actions.openSpaceByName(name);
      }
      setModal(null);
    } catch (err) {
      setSpaces(prevSpaces);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function switchTo(name: string) {
    setBusy(true);
    setError(null);
    setModal({ kind: 'switch', name });
    try {
      await actions.openSpaceByName(name);
      setModal(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteCurrent() {
    setOpen(false);
    if (!current) return;
    const ok = await actions.confirm(`Delete space "${current}" and everything inside it?`);
    if (!ok) return;
    const prevSpaces = spaces;
    setSpaces((currentSpaces) => currentSpaces.filter((name) => name !== current));
    actions.goHome();
    try {
      await api.deleteSpace(current);
    } catch (err) {
      setSpaces(prevSpaces);
      try { await actions.openSpaceByName(current); } catch { /* original delete error is what matters */ }
      await actions.alert('Delete failed: ' + errorMessage(err));
    }
  }

  async function openCurrentInNewWindow() {
    setOpen(false);
    if (!current) return;
    const bridge = (window as { electron?: ElectronBridge }).electron;
    const ok = await bridge?.openSpaceWindow?.(current);
    if (!ok) await actions.alert('New window is only available in the desktop app.');
  }

  return (
    <>
      <span className="space-menu-wrap">
        <button
          className="icon-btn"
          type="button"
          title="Space actions"
          onClick={() => setOpen((v) => !v)}
        >⋯</button>
        {open && (
          <>
            <div className="embedder-backdrop" onClick={() => setOpen(false)} />
            <div className="space-menu" role="menu">
              <button type="button" onClick={() => openModal('switch')}>Switch space</button>
              <button type="button" onClick={() => { void openCurrentInNewWindow(); }} disabled={!current}>Open in new window</button>
              <button type="button" onClick={() => openModal('new')}>New space</button>
              <button type="button" onClick={() => openModal('rename')} disabled={!current}>Rename space</button>
              <button type="button" className="danger" onClick={() => { void deleteCurrent(); }} disabled={!current}>Delete space</button>
            </div>
          </>
        )}
      </span>
      {modal && (
        <ModalShell onCancel={busy ? () => {} : () => setModal(null)}>
          <h3>{modal.kind === 'new' ? 'New space' : modal.kind === 'rename' ? 'Rename space' : 'Switch space'}</h3>
          {modal.kind === 'switch' ? (
            spaces.length === 0 ? (
              <p className="modal-hint">No spaces found.</p>
            ) : (
              <div className="welcome-open-list">
                {spaces.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="welcome-open-row"
                    disabled={busy || name === current}
                    onClick={() => { void switchTo(name); }}
                  >{name}</button>
                ))}
              </div>
            )
          ) : (
            <input
              type="text"
              className="modal-input"
              autoFocus
              spellCheck={false}
              value={modal.name}
              disabled={busy}
              onChange={(e) => setModal({ ...modal, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === 'Enter') { e.preventDefault(); void submitName(); }
                if (e.key === 'Escape' && !busy) { e.preventDefault(); setModal(null); }
              }}
            />
          )}
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="modal-btn" onClick={() => setModal(null)} disabled={busy}>Cancel</button>
            {modal.kind !== 'switch' && (
              <button type="button" className="modal-btn primary" onClick={() => { void submitName(); }} disabled={busy || !modal.name.trim()}>
                {busy ? 'Saving…' : modal.kind === 'new' ? 'Create' : 'Rename'}
              </button>
            )}
          </div>
        </ModalShell>
      )}
    </>
  );
}

/** "+" icon in the sidebar header that opens a small picker for the
 *  new note's format. Default is HTML — what the README recommends
 *  for content meant to outlive a chat session — but Markdown stays
 *  one click away for quick drafts. Format is decided at create time,
 *  not via a setting; the picker enforces an explicit choice every
 *  time without making either option feel hidden.
 *
 *  The popover uses `position: fixed` with coords measured off the
 *  button — sidebar containers further up the tree have `overflow:
 *  hidden` and would otherwise clip an absolutely-positioned menu
 *  rendered inside them. Fixed lets the menu float over the whole
 *  viewport instead. */
function NewNoteButton() {
  const { state, actions } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const target = state.activeFolder || state.space || 'space root';

  function toggle() {
    if (menuOpen) { setMenuOpen(false); return; }
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    // Anchor the menu's LEFT edge to the button's left edge so it
    // grows RIGHTWARD into the main pane area. Anchoring right-edge
    // to button-right makes the menu bleed off the viewport's left
    // edge whenever the sidebar is narrower than the menu's min-width
    // (the menu's 220 px ends up at x ≈ -30, clipping "H"/"M").
    // position:fixed escapes sidebar overflow either way.
    setPos({ top: r.bottom + 4, left: r.left });
    setMenuOpen(true);
  }

  function create(format: 'html' | 'md') {
    setMenuOpen(false);
    void actions.newNote(format);
  }

  return (
    <>
      <button
        ref={buttonRef}
        className="icon-btn"
        type="button"
        title={'New note in ' + target}
        onClick={toggle}
      ><NewFileIcon /></button>
      {menuOpen && pos && (
        <>
          <div className="embedder-backdrop" onClick={() => setMenuOpen(false)} />
          <div
            className="embedder-menu"
            role="menu"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              // Explicit `auto` because `.embedder-menu` sets `right: 0`
              // at the class level; we need it cleared so `left` wins.
              right: 'auto',
              minWidth: 200,
            }}
          >
            <button
              type="button"
              className="embedder-menu-item"
              onClick={() => create('html')}
            >
              <span className="embedder-menu-text">
                <span className="embedder-menu-name">HTML note</span>
                <span className="embedder-menu-detail">richer structure · default</span>
              </span>
            </button>
            <button
              type="button"
              className="embedder-menu-item"
              onClick={() => create('md')}
            >
              <span className="embedder-menu-text">
                <span className="embedder-menu-name">Markdown note</span>
                <span className="embedder-menu-detail">quick draft</span>
              </span>
            </button>
          </div>
        </>
      )}
    </>
  );
}

/** Sidebar search input. Fires semantic search (`/api/search`) against
 *  the chunk index; input value updates immediately for responsiveness,
 *  the actual fetch debounces 250ms so fast typing isn't a stampede.
 *  Race protection lives in `actions.runSearch` itself. */
function SearchBox() {
  const { state, actions, dispatch } = useApp();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => { if (debounce.current) clearTimeout(debounce.current); }, []);

  // Hand the input handle to the store on mount so `actions.focusSearch`
  // can reach it without a global DOM query. Mirrors the `registerEditor`
  // pattern used by CodeEditor.
  useEffect(() => {
    actions.registerSearchInput(inputRef.current);
    return () => actions.registerSearchInput(null);
  }, [actions]);

  function onChange(value: string) {
    dispatch({ type: 'FILTER', q: value });
    if (debounce.current) clearTimeout(debounce.current);
    if (!value.trim()) {
      // Clear immediately on empty — no point waiting to drop hits.
      void actions.runSearch('');
      return;
    }
    debounce.current = setTimeout(() => { void actions.runSearch(value); }, 250);
  }

  return (
    <div className="side-search">
      <SearchIcon className="side-search-icon" />
      <input
        ref={inputRef}
        type="search"
        placeholder="Search notes…"
        autoComplete="off"
        spellCheck={false}
        value={state.filterQuery}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SyncButton() {
  const { actions } = useApp();
  const [tip, setTip] = useState('Re-scan disk for external changes');
  // Decoupled from `state.syncRunning` so the icon keeps spinning for
  // a guaranteed minimum even when the sync request resolves in <100ms
  // (small / already-indexed spaces). Without this the click felt
  // like nothing happened.
  const [spinning, setSpinning] = useState(false);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (tipTimer.current) clearTimeout(tipTimer.current); }, []);

  return (
    <button
      className={'icon-btn' + (spinning ? ' spinning' : '')}
      type="button"
      title={spinning ? 'Syncing…' : tip}
      disabled={spinning}
      onClick={async () => {
        setSpinning(true);
        setTip('Syncing…');
        const minSpin = new Promise((r) => setTimeout(r, 600));
        let ok = true;
        try {
          await Promise.all([actions.runSync(), minSpin]);
        } catch {
          ok = false;
          await minSpin;
        }
        setSpinning(false);
        setTip(ok ? 'Synced' : 'Sync failed');
        if (tipTimer.current) clearTimeout(tipTimer.current);
        tipTimer.current = setTimeout(
          () => setTip('Re-scan disk for external changes'),
          3000,
        );
      }}
    ><SyncIcon /></button>
  );
}

/** Toggle button: collapse-all when anything is open, expand-all when
 *  everything's already folded. Mirrors VSCode's explorer toolbar
 *  button so a single click always does the "obvious" thing for the
 *  current state. */
function FolderFoldToggle() {
  const { state, dispatch } = useApp();
  const allCollapsed = state.expanded.size === 0;
  return (
    <button
      className="icon-btn"
      type="button"
      title={allCollapsed ? 'Expand all folders' : 'Collapse all folders'}
      onClick={() => {
        if (allCollapsed) {
          dispatch({
            type: 'EXPAND_ALL_FOLDERS',
            paths: state.folders.map((f) => f.path),
          });
        } else {
          dispatch({ type: 'COLLAPSE_ALL_FOLDERS' });
        }
      }}
    >{allCollapsed ? <ExpandAllIcon /> : <CollapseAllIcon />}</button>
  );
}
