/**
 * One line of the file tree: its icon vocabulary, its indentation and rails,
 * and the button that carries the row's semantics.
 *
 * The row owns no tree state. Everything it needs to draw itself arrives as a
 * value and everything it can do leaves as a callback, so the tree component
 * stays the single place that decides what a gesture means.
 */
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
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';

import { Button } from '@/components/ui/button';
import { caretOffsetAtPoint } from '@/components/ui/inline-input';
import type { ViewerFormat } from '@/features/workspace/domain/tree';
import {
  fileIsRestricted,
  folderIsRestricted,
  type TreeRow,
  type WorkspaceEntry,
} from '@/features/workspace/domain/tree';
import { cn } from '@/lib/utils';
import { writeSourceDrag } from '@/shared/utils/source-drag';

const TREE_ROOT_INSET = 8;
const TREE_LEVEL_INDENT = 26;
const TREE_ICON_RADIUS = 7;

const FILE_ICONS: Record<ViewerFormat, LucideIcon> = {
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

const GENERIC_TITLE = 'Search and automatic Chat context exclude this file.';
const GENERIC_LABEL = 'excluded from Search and automatic Chat context';

export function rowInset(depth: number): CSSProperties {
  return { paddingLeft: `${TREE_ROOT_INSET + (depth - 1) * TREE_LEVEL_INDENT}px` };
}

/** The vertical guides that connect a nested row to its ancestors. */
export function Rails({ depth }: { depth: number }) {
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

export function entryOf(row: TreeRow): WorkspaceEntry {
  return { kind: row.node.type, path: row.node.path };
}

export function rowIsRestricted(row: TreeRow): boolean {
  return row.node.type === 'folder' ? folderIsRestricted(row.node) : fileIsRestricted(row.node);
}

/** A file the library will not index, so it never joins Search or Chat context. */
function rowIsGeneric(row: TreeRow): boolean {
  return row.node.type === 'file' && row.node.format === 'generic';
}

/** The run of a name a rename should offer for replacement: the stem ahead
 *  of a file's extension, or the whole name of a folder. */
export function nameSelection(row: TreeRow): { end: number; start: number } {
  const name = row.node.name;
  const dot = row.node.type === 'file' ? name.lastIndexOf('.') : -1;
  return { end: dot > 0 ? dot : name.length, start: 0 };
}

interface RowDescription {
  marker?: FileTreeRowMarker | undefined;
  revealLabel: string;
}

/** What the row announces. A restricted entry says what activating it does,
 *  a generic one says why Search cannot see it, and a marked one carries the
 *  preparation state that needs the user. */
function rowLabel(row: TreeRow, { marker, revealLabel }: RowDescription): string {
  if (rowIsRestricted(row)) return `${row.node.name}, restricted, ${revealLabel}`;
  if (rowIsGeneric(row)) return `${row.node.name}, ${GENERIC_LABEL}`;
  return marker ? `${row.node.name}, ${marker.title}` : row.node.name;
}

/** What the row says on hover; the full path when it has nothing else to say. */
function rowTitle(row: TreeRow, { marker, revealLabel }: RowDescription): string {
  if (rowIsRestricted(row)) return revealLabel;
  if (rowIsGeneric(row)) return GENERIC_TITLE;
  return marker?.title ?? row.node.path;
}

/** The leading icon: a folder's disclosure state, or the file's format. */
export function rowIcon(row: TreeRow, expanded: boolean): LucideIcon {
  if (row.node.type !== 'folder') return FILE_ICONS[row.node.format];
  if (rowIsRestricted(row)) return Folder;
  return expanded ? ChevronDown : ChevronRight;
}

export interface FileTreeRowProps {
  expanded: boolean;
  /** The active folder, for the source identity a drag carries. */
  folderPath: string;
  index: number;
  marker?: FileTreeRowMarker | undefined;
  onActivate(row: TreeRow): void;
  onFocus(path: string): void;
  onKeyDown(event: KeyboardEvent<HTMLButtonElement>, row: TreeRow, editable: boolean): void;
  onRename(row: TreeRow, caretOffset?: number): void;
  proximityActive: boolean;
  registerRow(path: string, element: HTMLButtonElement | null): void;
  revealLabel: string;
  row: TreeRow;
  selected: boolean;
  tabStop: boolean;
}

export function FileTreeRow({
  expanded,
  folderPath,
  index,
  marker,
  onActivate,
  onFocus,
  onKeyDown,
  onRename,
  proximityActive,
  registerRow,
  revealLabel,
  row,
  selected,
  tabStop,
}: FileTreeRowProps) {
  const restricted = rowIsRestricted(row);
  const editable = !restricted;
  const generic = rowIsGeneric(row);
  const draggable = row.node.type === 'file' && !restricted && !generic;
  const trailingIcon = restricted ? ExternalLink : marker ? MARKER_ICONS[marker.kind] : undefined;

  // A click acts at once: a folder toggle is the tree's most frequent gesture
  // and must not wait out a double-click window. Only the first click of a
  // double click acts, so a rename starts on the folder as that click left it,
  // or on a file already opened.
  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail > 1) return;
    onActivate(row);
  };

  const onDoubleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!editable) return;
    event.preventDefault();
    const target = event.target instanceof HTMLElement ? event.target : event.currentTarget;
    onRename(row, caretOffsetAtPoint(target, event.clientX, event.clientY));
  };

  return (
    <div className="relative z-10" role="none">
      <Rails depth={row.depth} />
      <Button
        active={selected}
        aria-expanded={row.node.type === 'folder' && !restricted ? expanded : undefined}
        aria-label={rowLabel(row, { marker, revealLabel })}
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
        draggable={draggable}
        leadingIcon={rowIcon(row, expanded)}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onDragStart={(event) => {
          if (!draggable) {
            event.preventDefault();
            return;
          }
          writeSourceDrag(event.dataTransfer, { folderPath, path: row.node.path });
        }}
        onFocus={() => onFocus(row.node.path)}
        onKeyDown={(event) => onKeyDown(event, row, editable)}
        ref={(element) => registerRow(row.node.path, element)}
        role="treeitem"
        size="compact"
        style={
          {
            ...(selected ? {} : { '--hover': 'transparent' }),
            ...rowInset(row.depth),
          } as CSSProperties
        }
        tabIndex={tabStop ? 0 : -1}
        title={rowTitle(row, { marker, revealLabel })}
        {...(trailingIcon === undefined ? {} : { trailingIcon })}
        variant="ghost"
      >
        {row.node.name}
      </Button>
    </div>
  );
}
