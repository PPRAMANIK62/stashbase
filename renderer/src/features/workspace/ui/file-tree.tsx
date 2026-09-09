import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleSlash,
  ExternalLink,
  FileAudio,
  FileCode2,
  FileImage,
  FileJson2,
  FileQuestion,
  FileText,
  FileType2,
  Folder,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';

import { Button } from '@/components/ui/button';
import { caretOffsetAtPoint } from '@/components/ui/inline-input';
import { FilesError, type FilesApi } from '@/features/workspace/application/ports';
import type { WorkspaceRuntime } from '@/features/workspace/application/runtime';
import {
  fileIsRestricted,
  folderIsRestricted,
  nextTreePath,
  type FileFormat,
  type TreeRow,
  type WorkspaceEntry,
  type WorkspaceListing,
} from '@/features/workspace/domain/tree';
import type { WorkspaceScope } from '@/features/workspace/domain/workspace';
import { useFileOperations } from '@/features/workspace/hooks/use-file-operations';
import { useFiles } from '@/features/workspace/hooks/use-files';
import { useReveal } from '@/features/workspace/hooks/use-reveal';
import { useTree } from '@/features/workspace/hooks/use-tree';
import { useProximityHover } from '@/hooks/use-proximity-hover';
import { useTouchPrimary } from '@/hooks/use-touch-primary';
import { useShape } from '@/lib/shape-context';
import { spring } from '@/lib/springs';
import { cn } from '@/lib/utils';
import type { SourceReference } from '@/shared/domain/source-reference';
import { writeSourceDrag } from '@/shared/utils/source-drag';

import { DeleteEntryDialog } from './delete-entry-dialog';
import { FileTreeMenu, type FileTreeMenuTarget } from './file-tree-menu';
import { FileTreeNameRow } from './file-tree-name-row';

const EMPTY_LISTING: WorkspaceListing = { files: [], folderName: '', folders: [] };
const TREE_PAGE_SIZE = 240;
const TREE_ROOT_INSET = 8;
const TREE_LEVEL_INDENT = 26;
const TREE_ICON_RADIUS = 7;
/** Sidebar regions and controls whose own right click never belongs to the tree. */
const FOREIGN_CONTEXT_MENU_OWNERS =
  '[data-sidebar="header"], [data-sidebar="footer"], button, a, input, textarea, [role="menu"], [role="dialog"], [role="tablist"]';

const FILE_ICONS: Record<FileFormat, LucideIcon> = {
  audio: FileAudio,
  docx: FileText,
  generic: FileQuestion,
  html: FileCode2,
  image: FileImage,
  json: FileJson2,
  md: FileText,
  pdf: FileType2,
  txt: FileText,
};

/** Preparation states that need the user. Pending work stays unmarked. */
export interface FileTreeRowMarker {
  kind: 'blocked' | 'cancelled' | 'failed';
  title: string;
}

const MARKER_ICONS: Record<FileTreeRowMarker['kind'], LucideIcon> = {
  blocked: CircleAlert,
  cancelled: CircleSlash,
  failed: TriangleAlert,
};

export interface FileTreeProps {
  api: FilesApi;
  onOpenSource?: (source: SourceReference) => void;
  /** Offered from the row context menu for failed or cancelled sources. */
  onReprocess?: (source: SourceReference) => void;
  onScopeLost?: (scope: WorkspaceScope) => void;
  /** Settles the open documents under an entry before it is renamed or
   *  deleted: saves and closes them and answers their sources, or null when
   *  a save failed and the entry must stay put. */
  retireSources?: (entry: WorkspaceEntry) => Promise<SourceReference[] | null>;
  revealLabel: string;
  /** Keyed by folder-relative file path. */
  rowMarkers?: Readonly<Record<string, FileTreeRowMarker>>;
  runtime: WorkspaceRuntime;
}

/** What one line of the tree shows: a listed entry, or the draft of a new one. */
type TreeItem =
  | { index: number; kind: 'row'; row: TreeRow }
  | { depth: number; entryKind: WorkspaceEntry['kind']; kind: 'draft'; parentPath: string };

function rowInset(depth: number): CSSProperties {
  return { paddingLeft: `${TREE_ROOT_INSET + (depth - 1) * TREE_LEVEL_INDENT}px` };
}

function Rails({ depth }: { depth: number }) {
  return (
    <>
      {Array.from({ length: Math.max(0, depth - 1) }, (_, level) => (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 z-10 w-px bg-border/60"
          data-tree-rail=""
          key={level}
          style={{
            left: `${TREE_ROOT_INSET + level * TREE_LEVEL_INDENT + TREE_ICON_RADIUS}px`,
          }}
        />
      ))}
    </>
  );
}

/** A folder's visible rows in the flat model, nested for rendering so the
 *  whole group can open and close as one motion. */
interface RenderNode {
  children: RenderNode[];
  item: TreeItem;
}

/**
 * The children of an expanded folder. The group springs open from the
 * folder row and closes back into it; while it is leaving, its rows are
 * inert and skipped by the proximity layer so nothing stale can be reached.
 * Clipping applies only while the height moves, so a row's focus ring is
 * never shaved once the group has settled.
 */
function TreeGroup({
  children,
  onSettle,
  reduceMotion,
}: {
  children: ReactNode;
  onSettle(): void;
  reduceMotion: boolean;
}) {
  const present = useIsPresent();
  const [moving, setMoving] = useState(false);
  return (
    <motion.div
      animate={{ height: 'auto', opacity: 1 }}
      aria-hidden={present ? undefined : true}
      className={moving || !present ? 'overflow-hidden' : undefined}
      data-tree-exiting={present ? undefined : ''}
      exit={{
        height: 0,
        opacity: 0,
        transition: reduceMotion ? { duration: 0 } : spring.moderate.exit,
      }}
      inert={!present}
      initial={{ height: 0, opacity: 0 }}
      onAnimationComplete={() => {
        setMoving(false);
        onSettle();
      }}
      onAnimationStart={() => setMoving(true)}
      transition={
        reduceMotion ? { duration: 0 } : { ...spring.moderate, opacity: { duration: 0.1 } }
      }
    >
      {children}
    </motion.div>
  );
}

function entryOf(row: TreeRow): WorkspaceEntry {
  return { kind: row.node.type, path: row.node.path };
}

function rowIsRestricted(row: TreeRow): boolean {
  return row.node.type === 'folder' ? folderIsRestricted(row.node) : fileIsRestricted(row.node);
}

/** The run of a name a rename should offer for replacement: the stem ahead
 *  of a file's extension, or the whole name of a folder. */
function nameSelection(row: TreeRow): { end: number; start: number } {
  const name = row.node.name;
  const dot = row.node.type === 'file' ? name.lastIndexOf('.') : -1;
  return { end: dot > 0 ? dot : name.length, start: 0 };
}

export function FileTree({
  api,
  onOpenSource,
  onReprocess,
  onScopeLost,
  retireSources,
  revealLabel,
  rowMarkers,
  runtime,
}: FileTreeProps) {
  const files = useFiles(runtime, api);
  const tree = useTree(runtime, files.data ?? EMPTY_LISTING);
  const reveal = useReveal(runtime, api);
  const operations = useFileOperations(runtime, api, { onOpenSource, retireSources });
  const [limit, setLimit] = useState(TREE_PAGE_SIZE);
  const [rovingPath, setRovingPath] = useState<string | null>(null);
  const [renameCaret, setRenameCaret] = useState<number | undefined>();
  /** The row that should take focus, stamped so a repeat request for the
   *  row that already holds the tab stop still lands. */
  const [focusRequest, setFocusRequest] = useState<{ path: string; revision: number } | null>(null);
  const focusRevision = useRef(0);
  const focusHandled = useRef(0);
  const rowElements = useRef(new Map<string, HTMLButtonElement>());
  const treeElement = useRef<HTMLDivElement>(null);
  const sectionElement = useRef<HTMLElement>(null);
  const shape = useShape();
  const reduceMotion = useReducedMotion() ?? false;
  const touchPrimary = useTouchPrimary();
  const {
    activeIndex,
    handlers: proximityHandlers,
    isMeasured,
    itemRects,
    registerItem,
    sessionRef,
  } = useProximityHover(treeElement);
  const { naming } = operations;

  useEffect(() => {
    if (files.error instanceof FilesError && files.error.kind === 'scope-lost') {
      onScopeLost?.(runtime.scope);
    }
  }, [files.error, onScopeLost, runtime]);

  useEffect(() => {
    setLimit(TREE_PAGE_SIZE);
    setRovingPath(null);
  }, [runtime.scope.generation]);

  const renderedRows = useMemo(() => tree.rows.slice(0, limit), [limit, tree.rows]);
  const renderedPathKey = useMemo(
    () => renderedRows.map((row) => row.node.path).join('\u0000'),
    [renderedRows],
  );
  const items = useMemo<TreeItem[]>(() => {
    const list: TreeItem[] = renderedRows.map((row, index) => ({ index, kind: 'row', row }));
    if (naming?.kind !== 'create') return list;
    const parentAt = renderedRows.findIndex((row) => row.node.path === naming.parentPath);
    const draft: TreeItem = {
      depth: parentAt >= 0 ? renderedRows[parentAt].depth + 1 : 1,
      entryKind: naming.entryKind,
      kind: 'draft',
      parentPath: naming.parentPath,
    };
    // The draft sits first under its parent, where the new entry will land
    // once it is named; a root draft heads the tree.
    list.splice(naming.parentPath === '' ? 0 : parentAt + 1, 0, draft);
    return list;
  }, [naming, renderedRows]);
  const nodes = useMemo<RenderNode[]>(() => {
    const roots: RenderNode[] = [];
    const folders = new Map<string, RenderNode>();
    for (const item of items) {
      const node: RenderNode = { children: [], item };
      const parent = item.kind === 'row' ? item.row.parentPath : item.parentPath || null;
      (parent === null ? roots : (folders.get(parent)?.children ?? roots)).push(node);
      if (item.kind === 'row' && item.row.node.type === 'folder') {
        folders.set(item.row.node.path, node);
      }
    }
    return roots;
  }, [items]);
  /** Bumped when a group finishes moving, so the proximity layer re-measures rows. */
  const [layoutRevision, setLayoutRevision] = useState(0);
  const bumpLayout = useCallback(() => setLayoutRevision((revision) => revision + 1), []);
  const tabStop =
    renderedRows.find((row) => row.node.path === rovingPath)?.node.path ??
    renderedRows.find((row) => row.node.path === tree.selectedPath)?.node.path ??
    renderedRows[0]?.node.path ??
    null;

  useLayoutEffect(() => {
    if (!focusRequest || focusHandled.current === focusRequest.revision) return;
    const element = rowElements.current.get(focusRequest.path);
    if (!element) return;
    focusHandled.current = focusRequest.revision;
    element.focus();
  }, [focusRequest, renderedPathKey]);

  useLayoutEffect(() => {
    const rows = Array.from(
      treeElement.current?.querySelectorAll<HTMLElement>('[data-proximity-index]') ?? [],
    ).filter((row) => row.closest('[data-tree-exiting]') === null);
    const indexOf = (row: HTMLElement) => Number(row.dataset.proximityIndex);
    rows.forEach((row) => registerItem(indexOf(row), row));
    return () => rows.forEach((row) => registerItem(indexOf(row), null));
  }, [layoutRevision, naming, registerItem, renderedPathKey]);

  // The section ends with its last row, but the empty sidebar space below
  // it, down to the footer, still reads as the file tree. A right click there
  // re-enters the section's own context menu at the pointer, as long as
  // Files is showing and nothing else claims the spot.
  useEffect(() => {
    const section = sectionElement.current;
    const frame =
      section?.closest<HTMLElement>('[data-sidebar="sidebar"]') ??
      section?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!section || !frame) return;
    const forward = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (event.defaultPrevented || !(target instanceof Element)) return;
      if (section.contains(target) || section.closest('[hidden]')) return;
      if (target.closest(FOREIGN_CONTEXT_MENU_OWNERS)) return;
      if (event.clientY < section.getBoundingClientRect().bottom) return;
      event.preventDefault();
      section.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: event.clientX,
          clientY: event.clientY,
        }),
      );
    };
    frame.addEventListener('contextmenu', forward);
    return () => frame.removeEventListener('contextmenu', forward);
    // The section only exists once the listing has settled.
  }, [files.status]);

  const activeRect = isMeasured && activeIndex !== null ? itemRects[activeIndex] : null;

  const focus = (path: string | null) => {
    if (!path) return;
    setRovingPath(path);
    setFocusRequest({ path, revision: ++focusRevision.current });
  };

  const endNaming = (returnTo: string | null) => {
    operations.cancelNaming();
    focus(returnTo);
  };

  // A settled mutation hands focus to the row it produced, once the
  // refreshed listing shows it.
  const { consumeSettledPath, settledPath } = operations;
  useEffect(() => {
    if (!settledPath || !renderedRows.some((row) => row.node.path === settledPath)) return;
    focus(settledPath);
    consumeSettledPath();
  }, [consumeSettledPath, renderedPathKey, renderedRows, settledPath]);

  const activate = (row: TreeRow) => {
    tree.select(row.node.path);
    setRovingPath(row.node.path);
    if (row.node.type === 'folder') {
      if (folderIsRestricted(row.node)) reveal.reveal(row.node.path);
      else tree.toggle(row.node.path);
    } else if (fileIsRestricted(row.node)) {
      reveal.reveal(row.node.path);
    } else {
      onOpenSource?.({ folderPath: runtime.scope.folder.path, path: row.node.path });
    }
  };

  const beginRename = (row: TreeRow, caretOffset?: number) => {
    tree.select(row.node.path);
    setRovingPath(row.node.path);
    setRenameCaret(caretOffset);
    operations.beginRename(entryOf(row));
  };

  // A click acts at once: a folder toggle is the tree's most frequent
  // gesture and must not wait out a double-click window. Only the first
  // click of a double click acts, so a rename starts on the folder as that
  // click left it, or on a file already opened.
  const onRowClick = (event: MouseEvent<HTMLButtonElement>, row: TreeRow) => {
    if (event.detail > 1) return;
    activate(row);
  };

  const onRowDoubleClick = (
    event: MouseEvent<HTMLButtonElement>,
    row: TreeRow,
    editable: boolean,
  ) => {
    if (!editable) return;
    event.preventDefault();
    const target = event.target instanceof HTMLElement ? event.target : event.currentTarget;
    beginRename(row, caretOffsetAtPoint(target, event.clientX, event.clientY));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, row: TreeRow, editable: boolean) => {
    const nextPath = nextTreePath(event.key, row.node.path, renderedRows);
    if (nextPath) {
      event.preventDefault();
      focus(nextPath);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate(row);
      return;
    }
    if (event.key === 'F2' && editable) {
      event.preventDefault();
      beginRename(row);
      return;
    }
    if (event.key === 'Delete' && editable) {
      event.preventDefault();
      operations.requestDelete(entryOf(row));
      return;
    }
    if (event.key === 'ArrowRight' && row.node.type === 'folder') {
      event.preventDefault();
      if (folderIsRestricted(row.node)) return;
      if (!tree.expanded[row.node.path]) tree.toggle(row.node.path);
      else
        focus(
          tree.rows.find((candidate) => candidate.parentPath === row.node.path)?.node.path ?? null,
        );
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (
        row.node.type === 'folder' &&
        !folderIsRestricted(row.node) &&
        tree.expanded[row.node.path]
      ) {
        tree.toggle(row.node.path);
      } else {
        focus(row.parentPath);
      }
    }
  };

  const reprocessableRow = (row: TreeRow): boolean => {
    const marker = row.node.type === 'file' ? rowMarkers?.[row.node.path] : undefined;
    return Boolean(marker && marker.kind !== 'blocked' && onReprocess && !rowIsRestricted(row));
  };

  const resolveMenuTarget = (event: MouseEvent<HTMLElement>): FileTreeMenuTarget => {
    const path =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-path]')?.dataset.path
        : undefined;
    const row = path === undefined ? undefined : renderedRows.find((r) => r.node.path === path);
    if (!row) return { kind: 'space' };
    return {
      entry: entryOf(row),
      kind: 'entry',
      reprocessable: reprocessableRow(row),
      restricted: rowIsRestricted(row),
    };
  };

  const sourceOf = (entry: WorkspaceEntry): SourceReference => ({
    folderPath: runtime.scope.folder.path,
    path: entry.path,
  });

  if (files.isPending) {
    return (
      <div className="flex items-center gap-2 px-4 py-5 text-caption text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />
        Loading files
      </div>
    );
  }

  if (files.isError) {
    return (
      <div className="px-4 py-4">
        <p className="text-caption text-destructive" role="alert">
          Files unavailable.
        </p>
        <Button
          className="mt-2"
          leadingIcon={RefreshCw}
          onClick={() => void files.refetch()}
          size="sm"
          variant="tertiary"
        >
          Retry
        </Button>
      </div>
    );
  }

  const namingProblem = naming ? operations.failure : null;

  const renderItem = (item: TreeItem): ReactNode => {
    if (item.kind === 'draft') {
      const where = item.parentPath ? `in ${item.parentPath}` : 'in folder root';
      return (
        <FileTreeNameRow
          icon={item.entryKind === 'folder' ? Folder : FileText}
          initialValue=""
          key={`draft:${item.entryKind}:${item.parentPath}`}
          label={`New ${item.entryKind} ${where}`}
          level={item.depth}
          onCancel={() => endNaming(item.parentPath || tabStop)}
          onCommit={(name) => void operations.commitNaming(name)}
          placeholder={item.entryKind === 'folder' ? 'Folder name' : 'File name'}
          problem={namingProblem}
          rails={<Rails depth={item.depth} />}
          style={rowInset(item.depth)}
        />
      );
    }

    const { index, row } = item;
    const restricted = rowIsRestricted(row);
    const editable = !restricted;
    const generic = row.node.type === 'file' && row.node.format === 'generic';
    const marker = row.node.type === 'file' ? rowMarkers?.[row.node.path] : undefined;
    const selected = tree.selectedPath === row.node.path;
    const proximityActive = activeIndex === index;
    const expanded = row.node.type === 'folder' && tree.expanded[row.node.path] === true;
    const ItemIcon =
      row.node.type === 'folder'
        ? restricted
          ? Folder
          : expanded
            ? ChevronDown
            : ChevronRight
        : FILE_ICONS[row.node.format];

    if (naming?.kind === 'rename' && naming.entry.path === row.node.path) {
      return (
        <FileTreeNameRow
          caretOffset={renameCaret}
          icon={ItemIcon}
          initialValue={row.node.name}
          key={row.node.path}
          label={`Rename ${row.node.name}`}
          level={row.depth}
          onCancel={() => endNaming(row.node.path)}
          onCommit={(name) => void operations.commitNaming(name)}
          problem={namingProblem}
          rails={<Rails depth={row.depth} />}
          selection={renameCaret === undefined ? nameSelection(row) : undefined}
          style={rowInset(row.depth)}
        />
      );
    }

    const label = restricted
      ? `${row.node.name}, restricted, ${revealLabel}`
      : generic
        ? `${row.node.name}, excluded from Search and automatic Chat context`
        : marker
          ? `${row.node.name}, ${marker.title}`
          : row.node.name;

    return (
      <div className="relative z-10" key={row.node.path} role="none">
        <Rails depth={row.depth} />
        <Button
          active={selected}
          aria-expanded={row.node.type === 'folder' && !restricted ? expanded : undefined}
          aria-label={label}
          aria-level={row.depth}
          aria-posinset={row.position}
          aria-selected={selected}
          aria-setsize={row.setSize}
          className={cn(
            'w-full justify-start',
            '[&>span:last-child]:w-full [&>span:last-child]:min-w-0 [&>span:last-child]:justify-start',
            '[&>span:last-child>span]:min-w-0 [&>span:last-child>span]:flex-1 [&>span:last-child>span]:truncate [&>span:last-child>span]:text-left [&>span:last-child>span]:[text-box:normal]',
            proximityActive && 'text-foreground [&_svg]:stroke-2',
            selected && 'text-foreground',
          )}
          data-path={row.node.path}
          data-proximity-index={index}
          draggable={row.node.type === 'file' && !restricted && !generic}
          leadingIcon={ItemIcon}
          onClick={(event) => onRowClick(event, row)}
          onDoubleClick={(event) => onRowDoubleClick(event, row, editable)}
          onDragStart={(event) => {
            if (row.node.type !== 'file' || restricted || generic) {
              event.preventDefault();
              return;
            }
            writeSourceDrag(event.dataTransfer, {
              folderPath: runtime.scope.folder.path,
              path: row.node.path,
            });
          }}
          onFocus={() => setRovingPath(row.node.path)}
          onKeyDown={(event) => onKeyDown(event, row, editable)}
          ref={(element) => {
            if (element) rowElements.current.set(row.node.path, element);
            else rowElements.current.delete(row.node.path);
          }}
          role="treeitem"
          size="compact"
          style={
            {
              ...(!selected ? { '--hover': 'transparent' } : {}),
              ...rowInset(row.depth),
            } as CSSProperties
          }
          tabIndex={tabStop === row.node.path ? 0 : -1}
          title={
            restricted
              ? revealLabel
              : generic
                ? 'Search and automatic Chat context exclude this file.'
                : (marker?.title ?? row.node.path)
          }
          trailingIcon={restricted ? ExternalLink : marker ? MARKER_ICONS[marker.kind] : undefined}
          variant="ghost"
        >
          {row.node.name}
        </Button>
      </div>
    );
  };

  const renderNodes = (list: RenderNode[]): ReactNode =>
    list.map((node) => {
      const folder =
        node.item.kind === 'row' && node.item.row.node.type === 'folder'
          ? node.item.row.node.path
          : null;
      const key =
        node.item.kind === 'row'
          ? node.item.row.node.path
          : `draft:${node.item.entryKind}:${node.item.parentPath}`;
      return (
        <Fragment key={key}>
          {renderItem(node.item)}
          {folder !== null && (
            <AnimatePresence initial={false}>
              {node.children.length > 0 && (
                <TreeGroup key={folder} onSettle={bumpLayout} reduceMotion={reduceMotion}>
                  {renderNodes(node.children)}
                </TreeGroup>
              )}
            </AnimatePresence>
          )}
        </Fragment>
      );
    });

  return (
    <FileTreeMenu
      actions={{
        onCreate: operations.beginCreate,
        onDelete: operations.requestDelete,
        onRename: (entry) => {
          const row = renderedRows.find((candidate) => candidate.node.path === entry.path);
          if (row) beginRename(row);
        },
        onReprocess: (entry) => onReprocess?.(sourceOf(entry)),
        onReveal: (entry) => void reveal.reveal(entry.path),
      }}
      render={
        <section aria-label="Files" className="min-w-0 px-2 pt-2 pb-2" ref={sectionElement} />
      }
      resolveTarget={resolveMenuTarget}
      revealLabel={revealLabel}
    >
      {items.length === 0 ? (
        <p className="px-2 py-4 text-caption leading-relaxed text-muted-foreground">
          This folder has no visible files yet.
        </p>
      ) : (
        <div
          aria-label="Files"
          className="relative"
          onMouseEnter={() => {
            if (!touchPrimary) proximityHandlers.onMouseEnter();
          }}
          onMouseLeave={proximityHandlers.onMouseLeave}
          onMouseMove={(event) => {
            if (!touchPrimary) proximityHandlers.onMouseMove(event);
          }}
          ref={treeElement}
          role="tree"
          tabIndex={-1}
        >
          <AnimatePresence>
            {activeRect && (
              <motion.div
                animate={{
                  height: activeRect.height,
                  left: activeRect.left,
                  opacity: 1,
                  top: activeRect.top,
                  width: activeRect.width,
                }}
                aria-hidden="true"
                className={cn('pointer-events-none absolute bg-hover', shape.bg)}
                data-tree-proximity=""
                exit={{ opacity: 0, transition: spring.fast.exit }}
                initial={{
                  height: activeRect.height,
                  left: activeRect.left,
                  opacity: 0,
                  top: activeRect.top,
                  width: activeRect.width,
                }}
                key={sessionRef.current}
                transition={
                  reduceMotion
                    ? { duration: 0, opacity: { duration: 0.08 } }
                    : { ...spring.fast, opacity: { duration: 0.08 } }
                }
              />
            )}
          </AnimatePresence>

          {renderNodes(nodes)}
        </div>
      )}

      {tree.rows.length > renderedRows.length && (
        <Button
          className="mt-1 w-full justify-start"
          onClick={() => setLimit((current) => current + TREE_PAGE_SIZE)}
          size="compact"
          variant="ghost"
        >
          Show {Math.min(TREE_PAGE_SIZE, tree.rows.length - renderedRows.length)} more
        </Button>
      )}

      {operations.failure && !naming && !operations.deleting && (
        <p className="px-2 pt-2 text-caption text-destructive" role="alert">
          {operations.failure}
        </p>
      )}
      {reveal.error && (
        <p className="px-2 pt-2 text-caption text-destructive" role="alert">
          {reveal.error}
        </p>
      )}

      <DeleteEntryDialog
        entry={operations.deleting}
        failure={operations.deleting ? operations.failure : null}
        onCancel={operations.cancelDelete}
        onConfirm={() => void operations.confirmDelete()}
        pending={operations.pending}
      />
    </FileTreeMenu>
  );
}
