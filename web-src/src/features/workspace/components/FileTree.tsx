import { createContext, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import '@/common/styles/tree.css';
import '@/features/workspace/workspace.css';
import { VIEWABLE_FILE_EXTENSION_ALTERNATION } from '@/../../shared/file-formats.ts';
import { BotIcon, ChevronDownIcon, ClaudeIcon } from '@/common/components/icons';
import type { FileMeta, FolderMeta } from '@/common/api/api';
import { useTreeRowDrag } from '@/features/workspace/hooks/useTreeRowDrag';
import { basename } from '@/common/lib/paths';
import { useAppActions, useWorkspace } from '@/store/contexts/AppContext';
import { getFileReadiness } from '@/store/lib/fileReadiness';
import { emptyStateClass } from '@/common/lib/emptyState';
import { FileTypeIcon, type FileGlyphFormat } from '@/common/components/FileTypeIcon';
import { RenameInput, useRenameTarget } from '@/features/workspace/components/RenameInput';

const VIEWABLE_EXTENSION_RE = new RegExp(`\\.(${VIEWABLE_FILE_EXTENSION_ALTERNATION})$`, 'i');

interface FolderNode {
  type: 'folder';
  name: string;
  path: string;
  children: TreeNode[];
}

interface FileNode {
  type: 'file';
  name: string;
  path: string;
  meta: FileMeta;
}

type TreeNode = FolderNode | FileNode;

const TreeFocusContext = createContext<{
  rovingPath: string | null;
  setRovingPath: (path: string) => void;
}>({ rovingPath: null, setRovingPath: () => undefined });

function buildTree(
  files: FileMeta[],
  folders: FolderMeta[],
  fileOrder: Record<string, string[]>,
): FolderNode {
  const root: FolderNode = { type: 'folder', name: '', path: '', children: [] };
  const folderMap = new Map<string, FolderNode>();
  folderMap.set('', root);

  const ensureFolder = (folderPath: string): FolderNode => {
    const cached = folderMap.get(folderPath);
    if (cached) return cached;
    const segs = folderPath.split('/');
    const parentPath = segs.slice(0, -1).join('/');
    const parent = ensureFolder(parentPath);
    const node: FolderNode = {
      type: 'folder',
      name: segs[segs.length - 1],
      path: folderPath,
      children: [],
    };
    parent.children.push(node);
    folderMap.set(folderPath, node);
    return node;
  };
  for (const f of folders) ensureFolder(f.path);

  for (const f of files) {
    const segs = f.name.split('/');
    const parentPath = segs.slice(0, -1).join('/');
    const parent = ensureFolder(parentPath);
    parent.children.push({
      type: 'file',
      name: segs[segs.length - 1],
      path: f.name,
      meta: f,
    });
  }

  // Sort: items the user has manually ordered come first (in the
  // recorded order), unranked items follow in folders-first +
  // alphabetical order. Names in `fileOrder` that no longer exist on
  // disk are dropped silently (renamed / deleted files don't keep
  // their slot).
  const sortNodes = (nodes: TreeNode[], parentPath: string) => {
    const order = fileOrder[parentPath];
    if (order && order.length > 0) {
      const rank = new Map<string, number>();
      order.forEach((name, i) => rank.set(name, i));
      nodes.sort((a, b) => {
        const ai = rank.get(a.name);
        const bi = rank.get(b.name);
        if (ai != null && bi != null) return ai - bi;
        if (ai != null) return -1;
        if (bi != null) return 1;
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    } else {
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }
    for (const n of nodes) if (n.type === 'folder') sortNodes(n.children, n.path);
  };
  sortNodes(root.children, '');
  return root;
}

function displayName(name: string): string {
  // Show the extension. Three viewer formats (md / html / pdf) coexist
  // — PDF-derived notes ship as a `paper.pdf` + `paper.html` pair, and
  // collapsing both to "paper" leaves them visually indistinguishable.
  // ICP is developers who already read extensions everywhere (IDE /
  // Finder / git), so the noise cost is small. Kept as a hook so we
  // can flip back to stripping later without churning call sites.
  return name;
}

function visibleNodePaths(nodes: TreeNode[], expanded: Set<string>, paths: string[] = []): string[] {
  for (const node of nodes) {
    paths.push(node.path);
    if (node.type === 'folder' && expanded.has(node.path)) {
      visibleNodePaths(node.children, expanded, paths);
    }
  }
  return paths;
}

export function FileTree() {
  const state = useWorkspace();
  const [rovingPath, setRovingPath] = useState<string | null>(null);
  const root = useMemo(
    () => buildTree(state.files, state.folders, state.fileOrder),
    [state.files, state.folders, state.fileOrder],
  );
  const visiblePaths = useMemo(
    () => visibleNodePaths(root.children, state.expanded),
    [root, state.expanded],
  );
  const effectiveRovingPath = rovingPath && visiblePaths.includes(rovingPath)
    ? rovingPath
    : state.selectedPath && visiblePaths.includes(state.selectedPath)
      ? state.selectedPath
      : visiblePaths[0] ?? null;
  const focusContext = useMemo(
    () => ({ rovingPath: effectiveRovingPath, setRovingPath }),
    [effectiveRovingPath],
  );

  const inputAtRoot = state.newFolderInputOpen && state.activeFolder === '';
  if (root.children.length === 0 && !inputAtRoot) {
    const { sourceCode = 0, other = 0 } = state.unsupportedFiles || {};
    const total = sourceCode + other;
    if (total > 0) {
      return (
        <div className={emptyStateClass + ' flex-col items-center gap-1 text-center'}>
          <div className="font-semibold text-foreground">No supported files found</div>
          {/* text-xs, the ramp's meta step — the note scales with
            * --ui-scale where the old hardcoded 11px did not. */}
          <div className="text-xs leading-snug">
            StashBase found {total} file{total === 1 ? '' : 's'} in this folder, but none can currently be displayed or indexed. Nothing on disk was changed.
          </div>
        </div>
      );
    }
    return <div className={emptyStateClass}>No notes yet — click + to create one</div>;
  }
  return (
    <TreeFocusContext.Provider value={focusContext}>
      <div role="tree" aria-label="Files">
        {inputAtRoot && <NewFolderInput parentPath="" depth={0} />}
        <TreeNodes nodes={root.children} depth={0} parent="" />
      </div>
    </TreeFocusContext.Provider>
  );
}

function TreeNodes({ nodes, depth, parent }: { nodes: TreeNode[]; depth: number; parent: string }) {
  // Current rendered basename order for these siblings — used by
  // drop-to-reorder so it can splice the dragged name into the right
  // position. Matches what `buildTree` produced (manual order + tail).
  const siblings = nodes.map((n) => n.name);
  return (
    <>
      {nodes.map((n) =>
        n.type === 'folder' ? (
          <FolderRow
            key={n.path}
            node={n}
            depth={depth}
            parent={parent}
            siblings={siblings}
          />
        ) : (
          <FileRow
            key={n.path}
            path={n.path}
            format={n.meta.format}
            depth={depth}
            paddingLeft={depth * 14 + 26}
            parent={parent}
            siblings={siblings}
          />
        ),
      )}
    </>
  );
}

function visibleTreeItems(current: HTMLElement): HTMLElement[] {
  const tree = current.closest('[role="tree"]');
  if (!tree) return [];
  return Array.from(tree.querySelectorAll<HTMLElement>('[role="treeitem"]'))
    .filter((item) => !item.closest('.tree-children.collapsed'));
}

function moveTreeFocus(event: KeyboardEvent<HTMLDivElement>): boolean {
  const items = visibleTreeItems(event.currentTarget);
  const index = items.indexOf(event.currentTarget);
  let target: HTMLElement | undefined;
  if (event.key === 'ArrowDown') target = items[index + 1];
  else if (event.key === 'ArrowUp') target = items[index - 1];
  else if (event.key === 'Home') target = items[0];
  else if (event.key === 'End') target = items.at(-1);
  if (!target) return false;
  event.preventDefault();
  target.focus();
  return true;
}

function focusParentTreeItem(current: HTMLElement, parentPath: string): boolean {
  if (!parentPath) return false;
  const parent = visibleTreeItems(current).find((item) => item.dataset.path === parentPath);
  parent?.focus();
  return !!parent;
}

function FolderRow({
  node,
  depth,
  parent,
  siblings,
}: {
  node: FolderNode;
  depth: number;
  parent: string;
  siblings: string[];
}) {
  const state = useWorkspace();
  const { dispatch, actions } = useAppActions();
  const treeFocus = useContext(TreeFocusContext);
  const isExpanded = state.expanded.has(node.path);
  const isActive = state.selectedPath === node.path;
  const renaming = useRenameTarget(node.path, 'folder');
  const { dropEdge, dragProps } = useTreeRowDrag({
    kind: 'folder',
    path: node.path,
    name: node.name,
    parent,
    siblings,
  });

  const rowClass =
    'tree-row folder' +
    (isExpanded ? '' : ' collapsed') +
    (isActive ? ' active-folder' : '') +
    (dropEdge === 'into' ? ' drop-target' : '') +
    (dropEdge === 'above' ? ' drop-edge-above' : '') +
    (dropEdge === 'below' ? ' drop-edge-below' : '');

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).focus({ preventScroll: true });
    dispatch({
      type: 'CTX_MENU',
      menu: { x: e.clientX, y: e.clientY, target: node.path, kind: 'folder' },
    });
  }

  return (
    <>
      <div
        className={rowClass}
        role="treeitem"
        aria-label={node.name}
        aria-level={depth + 1}
        aria-expanded={isExpanded}
        aria-selected={isActive}
        tabIndex={treeFocus.rovingPath === node.path ? 0 : -1}
        style={{ paddingLeft: depth * 14 + 26 }}
        data-path={node.path}
        draggable={!renaming}
        {...dragProps}
        onFocus={() => treeFocus.setRovingPath(node.path)}
        onClick={() => {
          if (renaming) return;
          dispatch({ type: 'TOGGLE_FOLDER', path: node.path });
        }}
        onKeyDown={(e) => {
          if (moveTreeFocus(e)) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!renaming) dispatch({ type: 'TOGGLE_FOLDER', path: node.path });
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (!isExpanded) dispatch({ type: 'TOGGLE_FOLDER', path: node.path });
            else {
              const items = visibleTreeItems(e.currentTarget);
              items[items.indexOf(e.currentTarget) + 1]?.focus();
            }
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (isExpanded) dispatch({ type: 'TOGGLE_FOLDER', path: node.path });
            else focusParentTreeItem(e.currentTarget, parent);
          }
        }}
        onContextMenu={onContextMenu}
      >
        <span className="chev"><ChevronDownIcon /></span>
        {renaming ? (
          <RenameInput
            initialBasename={node.name}
            ext=""
            ariaLabel={`Rename folder ${node.name}`}
            onCommit={(newName) => {
              void actions.renameFolder(node.path, newName);
            }}
            onCancel={() => dispatch({ type: 'RENAMING', renaming: null })}
          />
        ) : (
          <span className="label">{node.name}</span>
        )}
      </div>
      <div
        className={'tree-children' + (isExpanded ? '' : ' collapsed')}
        role="group"
      >
        {state.newFolderInputOpen && state.activeFolder === node.path && (
          <NewFolderInput parentPath={node.path} depth={depth + 1} />
        )}
        <TreeNodes nodes={node.children} depth={depth + 1} parent={node.path} />
      </div>
    </>
  );
}

function FileRow({
  path,
  format,
  depth,
  paddingLeft,
  parent,
  siblings,
}: {
  path: string;
  format: 'md' | 'html' | 'json' | 'pdf' | 'image' | 'docx' | 'audio';
  depth: number;
  paddingLeft: number;
  parent: string;
  siblings: string[];
}) {
  const state = useWorkspace();
  const { actions, dispatch } = useAppActions();
  const treeFocus = useContext(TreeFocusContext);
  const isActive = state.selectedPath === path;
  const readiness = getFileReadiness(state, path);
  const renaming = useRenameTarget(path, 'file');

  const name = basename(path);
  // Named agent rules-books are tagged by their owner's logo. They are still
  // ordinary Markdown files in the tree; only the glyph changes.
  const metaIcon = agentRulesIcon(name);
  const { dropEdge, dragProps } = useTreeRowDrag({
    kind: 'file',
    path,
    name,
    parent,
    siblings,
  });

  const rowClass =
    `tree-row file format-${format}` +
    (isActive ? ' active' : '') +
    (readiness.preparationFailure ? ' preparation-failed' : '') +
    (readiness.preparationCancellation ? ' preparation-cancelled' : '') +
    (dropEdge === 'above' ? ' drop-edge-above' : '') +
    (dropEdge === 'below' ? ' drop-edge-below' : '');

  const display = displayName(name);
  const title = readiness.preparationFailure
    ? `File preparation failed; this file may not be searchable. ${path}`
    : readiness.preparationCancellation
      ? `File preparation was cancelled; this file is not searchable until reprocessed. ${path}`
    : path;
  // Protect the extension during inline rename for every recognised
  // format — notes (md/html) *and* the binary viewer formats (pdf +
  // images). Without the binaries here, editing "photo.png" exposes the
  // whole name and a user can drop ".png", which silently breaks format
  // detection (the row vanishes) and orphans the derived OCR note.
  const extMatch = name.match(VIEWABLE_EXTENSION_RE);
  const ext = extMatch ? extMatch[0] : '';

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).focus({ preventScroll: true });
    dispatch({
      type: 'CTX_MENU',
      menu: { x: e.clientX, y: e.clientY, target: path, kind: 'file' },
    });
  }

  function openFile() {
    const activeTab = state.activeTab;
    // An out-of-folder tab with the same relative name is a different file.
    if (activeTab?.file?.name === path && !activeTab.file.folder) {
      dispatch({ type: 'SELECT_PATH', path });
    } else {
      void actions.selectFile(path);
    }
  }

  return (
    <div
      className={rowClass}
      role="treeitem"
      aria-label={display}
      aria-level={depth + 1}
      aria-selected={isActive}
      tabIndex={treeFocus.rovingPath === path ? 0 : -1}
      style={{ paddingLeft }}
      data-path={path}
      title={title}
      draggable={!renaming}
      {...dragProps}
      onFocus={() => treeFocus.setRovingPath(path)}
      onClick={() => {
        if (renaming) return;
        // Single-click → open the file in its own persistent tab (or
        // focus the tab that already has it). The wasteful reload case
        // (clicking the file open in THIS tab) is handled inside
        // `selectFile` — it sees the file is already shown and just
        // re-selects the row. There is no double-click open: one click
        // always opens a lasting tab.
        openFile();
      }}
      onKeyDown={(e) => {
        if (moveTreeFocus(e)) return;
        if (e.key === 'ArrowLeft') {
          if (focusParentTreeItem(e.currentTarget, parent)) e.preventDefault();
          return;
        }
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        if (!renaming) openFile();
      }}
      onContextMenu={onContextMenu}
    >
      <span className="icon">{metaIcon ?? <FileTypeIcon format={format} />}</span>
      {renaming ? (
        <RenameInput
          initialBasename={ext ? name.slice(0, -ext.length) : name}
          ext={ext}
          ariaLabel={`Rename file ${name}`}
          onCommit={(newBasename) => {
            void actions.renameFile(path, newBasename);
          }}
          onCancel={() => dispatch({ type: 'RENAMING', renaming: null })}
        />
      ) : (
        <span className="label">{display}</span>
      )}
      {readiness.preparationFailure ? (
        <span
          className="preparation-status-icon preparation-failure-icon"
          aria-label="File preparation failed"
          title="File preparation failed; this file may not be searchable."
        >
          <WarningGlyph />
        </span>
      ) : readiness.preparationCancellation ? (
        <span
          className="preparation-status-icon preparation-cancelled-icon"
          aria-label="File preparation cancelled"
          title="File preparation was cancelled. Reprocess it when you want searchable text."
        >
          <CancelledGlyph />
        </span>
      ) : null}
    </div>
  );
}

function CancelledGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.25 8h5.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function agentRulesIcon(basename: string) {
  const normalized = basename.toLowerCase();
  // The Claude mark keeps its baked-in brand coral. It is now the only
  // coloured glyph in the tree — the format icons went muted — but it is a
  // LOGO, not a state or a category, and CLAUDE.md appears at most once per
  // folder, so it stays inside the one-small-moment colour budget rather
  // than becoming a hue-per-row.
  // AGENTS.md stays muted — its bot represents a vendor-neutral contract.
  if (normalized === 'claude.md') return <ClaudeIcon />;
  if (normalized === 'agents.md') return <BotIcon className="agent-rules-icon" />;
  return null;
}

function WarningGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path className="warning-mark-shape" d="M8 2.2 14.4 13.2H1.6L8 2.2Z" />
      <text className="warning-mark-text" x="8" y="12" textAnchor="middle">!</text>
    </svg>
  );
}

/** Inline input for naming a new folder. Mounts inside the parent
 *  folder's children area (or at the top level when `parentPath`
 *  is `''`), so the affordance reads "the new folder will live
 *  here". Same Enter/Esc/blur/IME semantics as `<RenameInput>`. */
function NewFolderInput({ parentPath, depth }: { parentPath: string; depth: number }) {
  const { actions, dispatch } = useAppActions();
  const ref = useRef<HTMLInputElement | null>(null);
  const doneRef = useRef(false);

  useEffect(() => { ref.current?.focus(); }, []);

  function commit() {
    if (doneRef.current) return;
    doneRef.current = true;
    const name = ref.current?.value.trim() ?? '';
    dispatch({ type: 'NEW_FOLDER_INPUT', open: false });
    if (!name) return;
    const full = parentPath ? `${parentPath}/${name}` : name;
    void actions.newFolder(full);
  }
  function cancel() {
    if (doneRef.current) return;
    doneRef.current = true;
    dispatch({ type: 'NEW_FOLDER_INPUT', open: false });
  }

  return (
    <div
      className="tree-row folder new-folder-row"
      style={{ paddingLeft: depth * 14 + 26 }}
    >
      <span className="chev new-folder-spacer" aria-hidden="true" />
      <input
        ref={ref}
        type="text"
        aria-label={parentPath ? `New folder in ${parentPath}` : 'New folder in folder root'}
        className="tree-create-input"
        placeholder="New folder name…"
        onKeyDown={(e) => {
          // Skip while IME is composing — Chinese / Japanese / Korean
          // users press Enter to pick a candidate, not to commit.
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        onBlur={() => {
          if (doneRef.current) return;
          const name = ref.current?.value.trim() ?? '';
          if (name) commit(); else cancel();
        }}
      />
    </div>
  );
}
