import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
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
  type LucideIcon,
} from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';

import { Button } from '@/components/ui/button';
import type { FilesApi } from '@/features/workspace/application/ports';
import type { WorkspaceRuntime } from '@/features/workspace/application/runtime';
import {
  fileIsRestricted,
  folderIsRestricted,
  nextTreePath,
  type FileFormat,
  type TreeRow,
  type WorkspaceListing,
} from '@/features/workspace/domain/tree';
import { useFiles } from '@/features/workspace/hooks/use-files';
import { useReveal } from '@/features/workspace/hooks/use-reveal';
import { useTree } from '@/features/workspace/hooks/use-tree';
import { useProximityHover } from '@/hooks/use-proximity-hover';
import { useTouchPrimary } from '@/hooks/use-touch-primary';
import { useShape } from '@/lib/shape-context';
import { spring } from '@/lib/springs';
import { cn } from '@/lib/utils';

const EMPTY_LISTING: WorkspaceListing = { files: [], folderName: '', folders: [] };
const TREE_PAGE_SIZE = 240;
const TREE_ROOT_INSET = 8;
const TREE_LEVEL_INDENT = 26;
const TREE_ICON_RADIUS = 7;

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

export interface FileTreeProps {
  api: FilesApi;
  revealLabel: string;
  runtime: WorkspaceRuntime;
}

export function FileTree({ api, revealLabel, runtime }: FileTreeProps) {
  const files = useFiles(runtime, api);
  const tree = useTree(runtime, files.data ?? EMPTY_LISTING);
  const reveal = useReveal(runtime, api);
  const [limit, setLimit] = useState(TREE_PAGE_SIZE);
  const [rovingPath, setRovingPath] = useState<string | null>(null);
  const focusRequested = useRef(false);
  const rowElements = useRef(new Map<string, HTMLButtonElement>());
  const treeElement = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    setLimit(TREE_PAGE_SIZE);
    setRovingPath(null);
  }, [runtime.scope.generation]);

  const renderedRows = useMemo(() => tree.rows.slice(0, limit), [limit, tree.rows]);
  const renderedPathKey = useMemo(
    () => renderedRows.map((row) => row.node.path).join('\u0000'),
    [renderedRows],
  );
  const tabStop =
    renderedRows.find((row) => row.node.path === rovingPath)?.node.path ??
    renderedRows.find((row) => row.node.path === tree.selectedPath)?.node.path ??
    renderedRows[0]?.node.path ??
    null;

  useLayoutEffect(() => {
    if (!focusRequested.current || !tabStop) return;
    focusRequested.current = false;
    rowElements.current.get(tabStop)?.focus();
  }, [tabStop]);

  useLayoutEffect(() => {
    const rows = Array.from(
      treeElement.current?.querySelectorAll<HTMLElement>('[data-proximity-index]') ?? [],
    );
    rows.forEach((row, index) => registerItem(index, row));
    return () => rows.forEach((_, index) => registerItem(index, null));
  }, [registerItem, renderedPathKey]);

  const activeRect = isMeasured && activeIndex !== null ? itemRects[activeIndex] : null;

  const focus = (path: string | null) => {
    if (!path) return;
    focusRequested.current = true;
    setRovingPath(path);
  };

  const activate = (row: TreeRow) => {
    tree.select(row.node.path);
    setRovingPath(row.node.path);
    if (row.node.type === 'folder') {
      if (folderIsRestricted(row.node)) reveal.reveal(row.node.path);
      else tree.toggle(row.node.path);
    } else if (fileIsRestricted(row.node)) {
      reveal.reveal(row.node.path);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, row: TreeRow) => {
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

  return (
    <section aria-label="Files" className="min-w-0 px-2 pt-2 pb-2">
      {tree.rows.length === 0 ? (
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

          {renderedRows.map((row, index) => {
            const restricted =
              row.node.type === 'folder'
                ? folderIsRestricted(row.node)
                : fileIsRestricted(row.node);
            const generic = row.node.type === 'file' && row.node.format === 'generic';
            const selected = tree.selectedPath === row.node.path;
            const proximityActive = activeIndex === index;
            const expanded = row.node.type === 'folder' && tree.expanded[row.node.path] === true;
            const label = restricted
              ? `${row.node.name}, restricted, ${revealLabel}`
              : generic
                ? `${row.node.name}, excluded from Search and automatic Chat context`
                : row.node.name;
            const ItemIcon =
              row.node.type === 'folder'
                ? restricted
                  ? Folder
                  : expanded
                    ? ChevronDown
                    : ChevronRight
                : FILE_ICONS[row.node.format];

            return (
              <div className="relative z-10" key={row.node.path} role="none">
                {Array.from({ length: Math.max(0, row.depth - 1) }, (_, level) => (
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
                  leadingIcon={ItemIcon}
                  onClick={() => activate(row)}
                  onFocus={() => setRovingPath(row.node.path)}
                  onKeyDown={(event) => onKeyDown(event, row)}
                  ref={(element) => {
                    if (element) rowElements.current.set(row.node.path, element);
                    else rowElements.current.delete(row.node.path);
                  }}
                  role="treeitem"
                  size="compact"
                  style={
                    {
                      ...(!selected ? { '--hover': 'transparent' } : {}),
                      paddingLeft: `${TREE_ROOT_INSET + (row.depth - 1) * TREE_LEVEL_INDENT}px`,
                    } as CSSProperties
                  }
                  tabIndex={tabStop === row.node.path ? 0 : -1}
                  title={
                    restricted
                      ? revealLabel
                      : generic
                        ? 'Search and automatic Chat context exclude this file.'
                        : row.node.path
                  }
                  trailingIcon={restricted ? ExternalLink : undefined}
                  variant="ghost"
                >
                  {row.node.name}
                </Button>
              </div>
            );
          })}
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

      {reveal.error && (
        <p className="px-2 pt-2 text-caption text-destructive" role="alert">
          {reveal.error}
        </p>
      )}
    </section>
  );
}
