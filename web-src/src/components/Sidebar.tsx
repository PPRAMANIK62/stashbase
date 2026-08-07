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
import { DocumentOutline } from './DocumentOutline';
import { useDocumentOutline } from './DocumentOutlineContext';
import { Menu, type MenuItem } from './Menu';
import { ModalShell } from './ModalShell';
import { SearchPanel } from './SearchPanel';
import { Button } from './ui/button';
import { StatusMessage } from './ui/status';
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
    /* Explicit h-full so the inner file list (flex-1) knows how much to
     * grow into; overflow-hidden clips content as the grid column
     * resizes / collapses to the bare 44px rail — without it, file
     * names visually spill into the main pane mid-transition.
     * `group/sidebar` drives the hover-reveal of the header action
     * icons (see the side-actions class strings below). */
    <aside className="sidebar group/sidebar relative flex h-full min-h-0 min-w-0 flex-row overflow-hidden border-r border-border bg-pane">
      <ActivityBar />
      {/* The panel that swaps content based on `state.activeSidebarView`;
        * it owns the vertical stack (header / list). */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {state.activeSidebarView === 'search' ? <SearchPanel /> : <FilesPanel />}
      </div>
    </aside>
  );
}

/* Header action icons stay invisible until the pointer is over the
 * sidebar, mirroring VS Code's quiet explorer toolbar. */
const sideActionsClass =
  'flex gap-0.5 opacity-0 transition-opacity duration-fast group-hover/sidebar:opacity-100';

/* Top tier of the VSCode-style two-row header: a quiet section label on
 * the left; chevron rotation is keyed off the toggle's aria-expanded so
 * the visual state can never drift from the accessible one. */
const sectionToggleClass =
  'inline-flex min-w-0 flex-1 cursor-pointer items-center gap-0.5 border-0 bg-transparent p-0 text-left '
  + 'text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:outline-none '
  + '[&>svg]:size-3.5 [&>svg]:flex-none [&>svg]:transition-transform [&>svg]:duration-fast '
  + 'aria-[expanded=false]:[&>svg]:-rotate-90';

const sectionTitleClass =
  'min-w-0 truncate text-xs font-semibold tracking-[.06em] uppercase text-muted-foreground';

/** The Explorer view. Files and the active Markdown document outline share
 * this one sidebar as independently collapsible sections, like VS Code. */
function FilesPanel() {
  const { state, actions, dispatch, activeTab } = useApp();
  const { outline } = useDocumentOutline();
  const [sideHeadDrop, setSideHeadDrop] = useState(false);
  const [filesExpanded, setFilesExpanded] = useState(true);
  const [outlineExpanded, setOutlineExpanded] = useState(true);

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
  const hasMarkdownDocument = activeTab?.file?.format === 'md';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" id="sidebar-panel-files" role="tabpanel">
      {/* Explorer sections mirror VS Code's compact disclosure rows. Files
        * and the active document's outline intentionally share one
        * navigation surface; neither becomes a floating editor companion. */}
      <section className={'flex min-h-0 flex-col overflow-hidden border-b border-border ' + (filesExpanded ? 'flex-[3_1_0%]' : 'flex-none')}>
        <div className="flex min-h-[30px] items-center gap-1.5 pt-2 pr-2 pb-0.5 pl-3">
          <button
            type="button"
            className={sectionToggleClass + ' flex-none'}
            aria-expanded={filesExpanded}
            aria-controls="sidebar-files-section"
            onClick={() => setFilesExpanded((expanded) => !expanded)}
          ><ChevronDownIcon /><span className={sectionTitleClass}>Files</span></button>
          <div className={sideActionsClass + ' ml-auto'}>
            <FolderMenu />
          </div>
        </div>
        <div id="sidebar-files-section" className={filesExpanded ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'hidden'}>
          {/* The current folder row — brighter than the muted "FILES"
            * section label above it, mirroring VSCode's workspace name.
            * `.side-head` + `drop-target` / `active-root` state classes
            * stay CSS-driven: `useGlobalDragDrop` toggles `drop-target`
            * imperatively on #sideHead, and both rules share the tree's
            * exempted selected/drop styling (see sidebar.css). */}
          <div
            id="sideHead"
            className={
              'side-head flex items-center justify-between gap-1.5 py-0.5 pr-2 pl-3'
              + (sideHeadDrop ? ' drop-target' : '')
              + (rootSelected ? ' active-root' : '')
            }
            onDragOver={onSideHeadDragOver}
            onDragLeave={onSideHeadDragLeave}
            onDrop={onSideHeadDrop}
          >
            <span className="flex min-w-0 flex-1 cursor-pointer items-center gap-0.5 text-muted-foreground hover:text-foreground">
              <span
                className={'inline-flex size-4 flex-none items-center justify-center transition-transform duration-fast [&_svg]:size-3.5' + (state.folderCollapsed ? ' -rotate-90' : '')}
                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'FOLDER_FOLD_TOGGLE' }); }}
              ><ChevronDownIcon /></span>
              <span
                className="min-w-0 flex-1 truncate text-xs font-semibold tracking-[.04em] uppercase text-foreground"
                title={state.folder || 'notes'}
                onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ACTIVE_FOLDER', path: '' }); }}
              >{(state.folder || 'notes').toUpperCase()}</span>
            </span>
            <div className={sideActionsClass}>
              <NewNoteButton />
              <Button variant="ghost" size="icon-sm" className="text-muted-foreground" title={'New folder in ' + (state.activeFolder || (state.folder || 'folder root'))} onClick={() => {
                if (state.activeFolder) dispatch({ type: 'EXPAND_FOLDER', path: state.activeFolder });
                dispatch({ type: 'NEW_FOLDER_INPUT', open: true });
              }}><NewFolderIcon /></Button>
              <SyncButton />
              <FolderFoldToggle />
            </div>
          </div>
          {/* Collapsing hides the list but leaves the `expanded` set in
            * state untouched, so re-expanding restores every inner
            * folder's prior open/closed state. */}
          <div className={'flex-1 overflow-y-auto pb-2' + (state.folderCollapsed ? ' hidden' : '')}>
            <FileTree />
          </div>
        </div>
      </section>
      {hasMarkdownDocument && (
        <section className={'flex min-h-0 flex-col overflow-hidden border-b border-border ' + (outlineExpanded ? 'flex-[2_1_0%]' : 'flex-none')}>
          <div className="flex min-h-[30px] items-center justify-between gap-1.5 py-[5px] pr-2 pl-3">
            <button type="button" className={sectionToggleClass} aria-expanded={outlineExpanded} aria-controls="sidebar-outline-section" onClick={() => setOutlineExpanded((expanded) => !expanded)}>
              <ChevronDownIcon /><span className={sectionTitleClass + ' flex-1'}>Document Outline</span><span className="ml-auto flex-none text-2xs text-muted-foreground">{outline.headings.length}</span>
            </button>
          </div>
          <div id="sidebar-outline-section" className={outlineExpanded ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'hidden'}>
            <DocumentOutline headings={outline.headings} activeId={outline.activeId} onSelect={outline.onSelect} />
          </div>
        </section>
      )}
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
        title: 'Create or select folder',
        buttonLabel: 'Select folder',
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
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon-sm"
        className="text-base text-muted-foreground"
        title="Folder actions"
        onClick={toggle}
      >⋯</Button>
      {anchor && <Menu anchor={{ rect: anchor }} items={items} onClose={() => setAnchor(null)} />}
      {switchOpen && (
        <ModalShell title="Switch folder" top onCancel={busy ? () => {} : () => setSwitchOpen(false)}>
          {state.recent.length === 0 ? (
            <p className="mt-0 mb-3.5 text-base leading-normal text-muted-foreground">No folders found.</p>
          ) : (
            <div className="mt-2 mb-3 flex max-h-[260px] flex-col overflow-y-auto rounded-lg border border-border">
              {state.recent.map((folder) => {
                const name = folder.path.split('/').filter(Boolean).pop() || folder.path;
                const isCurrent = folder.path === current || name === current;
                return (
                  <button
                    key={folder.path}
                    type="button"
                    className={
                      'group/row flex cursor-pointer items-center gap-2.5 border-0 border-b border-border bg-transparent '
                      + 'px-3.5 py-2.5 text-left text-base text-foreground transition-colors duration-fast last:border-b-0 '
                      + 'enabled:hover:bg-accent/5 disabled:cursor-default disabled:opacity-60 '
                      /* Trailing "›" affordance slides in on hover; hidden
                       * entirely on the disabled (current / busy) rows. */
                      + "after:flex-none after:-translate-x-1 after:text-xl after:leading-none after:text-accent "
                      + "after:opacity-0 after:transition-[opacity,transform] after:duration-fast after:content-['›'] "
                      + 'enabled:hover:after:translate-x-0 enabled:hover:after:opacity-100 disabled:after:content-none'
                    }
                    disabled={busy || isCurrent}
                    onClick={() => { void switchTo(folder.path); }}
                  >
                    <FolderIcon className="size-4 flex-none text-muted-foreground transition-colors duration-fast group-enabled/row:group-hover/row:text-accent" />
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                  </button>
                );
              })}
            </div>
          )}
          {error && <StatusMessage tone="error" className="mt-2.5">{error}</StatusMessage>}
          <div className="mt-3.5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSwitchOpen(false)} disabled={busy}>Cancel</Button>
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
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground"
      title={'New note in ' + target}
      onClick={() => void actions.newNote()}
    ><NewFileIcon /></Button>
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
    <Button
      variant="ghost"
      size="icon-sm"
      className={'text-muted-foreground' + (spinning ? ' [&_svg]:animate-spin [&_svg]:[animation-duration:700ms]' : '')}
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
    ><SyncIcon /></Button>
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
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground"
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
    >{allCollapsed ? <ExpandAllIcon /> : <CollapseAllIcon />}</Button>
  );
}
