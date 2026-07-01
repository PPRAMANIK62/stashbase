import {
  ChevronDownIcon,
  CollapseAllIcon,
  ExpandAllIcon,
  FolderIcon,
  NewFileIcon,
  NewFolderIcon,
  SyncIcon,
} from '../icons';
import { useApp } from '../store/AppContext';
import { ActivityBar } from './ActivityBar';
import { FileTree } from './FileTree';
import { Menu, type MenuItem } from './Menu';
import { ModalShell } from './ModalShell';
import { SearchPanel } from './SearchPanel';
import { api, errorMessage } from '../api';
import { FILE_MIME } from '../dragMime';
import { useEffect, useRef, useState, type DragEvent } from 'react';

interface ElectronBridge {
  openFolderDialog?: (opts?: {
    title?: string;
    buttonLabel?: string;
    defaultPath?: string;
    allowCreateDirectory?: boolean;
  }) => Promise<string | null>;
  openFolderWindow?: (folder: string) => Promise<boolean>;
}

/**
 * Left rail composition. The activity bar (narrow icon column on the
 * far left) toggles between two mutually-exclusive side panels:
 *   - Files   → the index warning, the FOLDER header, and the file tree
 *   - Search  → search input + ≈/= toggle + result list (see
 *               `SearchPanel.tsx`)
 *
 * Each panel keeps its own state when hidden — flipping back doesn't
 * blow away tree expansion or the active query.
 */
export function Sidebar() {
  const { state } = useApp();
  return (
    <aside className="sidebar">
      <ActivityBar />
      <div className="sidebar-panel">
        {state.activeSidebarView === 'search' ? <SearchPanel /> : <FilesPanel />}
      </div>
    </aside>
  );
}

/** The current sidebar content minus the search input — owns a
 *  VSCode-style two-tier FOLDER header (a
 *  "FOLDER" section row with the folder-actions ⋯ above the folder row:
 *  current folder name + the 4 file-action buttons), and the file tree. */
function FilesPanel() {
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

  return (
    <div className="files-panel" id="sidebar-panel-files" role="tabpanel">
      {/* VSCode-style two-tier header: a section-title row ("FOLDER" +
          folder-actions ⋯, mirroring EXPLORER) above the folder row
          (current folder name + file actions). */}
      <div className="panel-section-head folder-section-head">
        <span className="panel-section-title">FOLDER</span>
        <div className="side-actions">
          <FolderMenu />
        </div>
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
        <span className={'folder-title' + (state.folderCollapsed ? ' collapsed' : '')}>
          {/* Chevron alone toggles whole-folder fold. Clicking the
              label selects "folder root" so the next new-note / +folder
              lands at the top level — mirrors VSCode where the
              workspace header is itself a selectable container. */}
          <span
            className="folder-chev"
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'FOLDER_FOLD_TOGGLE' });
            }}
          ><ChevronDownIcon /></span>
          <span
            className="folder-label"
            title={state.folder || 'notes'}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'ACTIVE_FOLDER', path: '' });
            }}
          >{(state.folder || 'notes').toUpperCase()}</span>
        </span>
        <div className="side-actions">
          <NewNoteButton />
          <button
            className="icon-btn"
            type="button"
            title={'New folder in ' + (state.activeFolder || (state.folder || 'folder root'))}
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
      <div className={'file-list' + (state.folderCollapsed ? ' collapsed' : '')}>
        <FileTree />
      </div>
    </div>
  );
}

function FolderMenu() {
  const { state, actions } = useApp();
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = state.folder || '';
  const currentPath = state.folderPath || '';

  function toggle() {
    if (anchor) { setAnchor(null); return; }
    const r = buttonRef.current?.getBoundingClientRect();
    if (r) setAnchor(r);
  }

  function openSwitchModal() {
    setError(null);
    setAnchor(null);
    setSwitchOpen(true);
  }

  async function switchTo(path: string) {
    setBusy(true);
    setError(null);
    try {
      await actions.openFolder(path);
      setSwitchOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function openCurrentInNewWindow() {
    if (!currentPath) return;
    const bridge = (window as { electron?: ElectronBridge }).electron;
    const ok = await bridge?.openFolderWindow?.(currentPath);
    if (!ok) await actions.alert('New window is only available in the desktop app.');
  }

  async function newFolderFromPicker() {
    setAnchor(null);
    const bridge = (window as { electron?: ElectronBridge }).electron;
    if (typeof bridge?.openFolderDialog !== 'function') {
      await actions.alert('New folder is only available in the desktop app.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { path } = await api.getFolderHome();
      const picked = await bridge.openFolderDialog({
        title: 'New folder',
        buttonLabel: 'Open',
        defaultPath: path,
        allowCreateDirectory: true,
      });
      if (picked) await actions.openFolder(picked);
    } catch (err) {
      await actions.alert('New folder failed: ' + errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const items: MenuItem[] = [
    { label: 'Switch folder', onSelect: openSwitchModal },
    { label: 'Open in new window', disabled: !current, onSelect: () => { void openCurrentInNewWindow(); } },
    { label: 'New folder', onSelect: () => { void newFolderFromPicker(); } },
  ];

  return (
    <>
      <button
        ref={buttonRef}
        className="icon-btn"
        type="button"
        title="Folder actions"
        onClick={toggle}
      >⋯</button>
      {anchor && <Menu anchor={{ rect: anchor }} items={items} onClose={() => setAnchor(null)} />}
      {switchOpen && (
        <ModalShell top onCancel={busy ? () => {} : () => setSwitchOpen(false)}>
          <h3>Switch folder</h3>
          {state.recent.length === 0 ? (
            <p className="modal-hint">No folders found.</p>
          ) : (
            <div className="welcome-open-list">
              {state.recent.map((folder) => {
                const name = folder.path.split('/').filter(Boolean).pop() || folder.path;
                const isCurrent = folder.path === current || name === current;
                return (
                  <button
                    key={folder.path}
                    type="button"
                    className="welcome-open-row"
                    disabled={busy || isCurrent}
                    onClick={() => { void switchTo(folder.path); }}
                  >
                    <FolderIcon className="welcome-open-row-icon" />
                    <span className="welcome-open-row-name">{name}</span>
                  </button>
                );
              })}
            </div>
          )}
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="modal-btn" onClick={() => setSwitchOpen(false)} disabled={busy}>Cancel</button>
          </div>
        </ModalShell>
      )}
    </>
  );
}

/** "+" icon in the sidebar header that creates a new Markdown note in
 *  the active folder. HTML notes were dropped once their editor went
 *  away, so there's no format picker — one click, one .md draft. */
function NewNoteButton() {
  const { state, actions } = useApp();
  const target = state.activeFolder || state.folder || 'folder root';

  return (
    <button
      className="icon-btn"
      type="button"
      title={'New note in ' + target}
      onClick={() => void actions.newNote()}
    ><NewFileIcon /></button>
  );
}

function SyncButton() {
  const { actions } = useApp();
  const [tip, setTip] = useState('Re-scan disk for external changes');
  // Decoupled from `state.syncRunning` so the icon keeps spinning for
  // a guaranteed minimum even when the sync request resolves in <100ms
  // (small / already-indexed folders). Without this the click felt
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
