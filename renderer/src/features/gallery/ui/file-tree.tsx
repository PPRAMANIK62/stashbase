/** The published file list of one Gallery entry, drawn as a collapsible tree.
 *  The flat paths are folded into folders here rather than by the server, so
 *  the shop can show a shape for any entry it can list. */
import { ChevronRight, Folder } from 'lucide-react';
import { useMemo, useState } from 'react';

import { FileTypeIcon } from '@/components/ui/file-type-icon';
import { focusRing } from '@/lib/focus-ring';
import { cn } from '@/lib/utils';

interface TreeFolder {
  files: string[];
  folders: TreeFolder[];
  name: string;
  path: string;
}

interface Row {
  depth: number;
  kind: 'file' | 'folder';
  name: string;
  path: string;
}

function sortTree(node: TreeFolder): void {
  node.folders.sort((left, right) => left.name.localeCompare(right.name));
  node.files.sort((left, right) => left.localeCompare(right));
  for (const child of node.folders) sortTree(child);
}

/** The published paths as one tree, folders before files and both sorted, so
 *  two entries with the same shape read the same way. */
function buildTree(paths: readonly string[]): TreeFolder {
  const root: TreeFolder = { files: [], folders: [], name: '', path: '' };
  for (const filePath of paths) {
    const parts = filePath.split('/');
    let node = root;
    for (const part of parts.slice(0, -1)) {
      let next = node.folders.find((folder) => folder.name === part);
      if (!next) {
        next = {
          files: [],
          folders: [],
          name: part,
          path: node.path ? `${node.path}/${part}` : part,
        };
        node.folders.push(next);
      }
      node = next;
    }
    node.files.push(parts.at(-1) ?? filePath);
  }
  sortTree(root);
  return root;
}

/** The tree as the flat list it is drawn as, so the number of rows on screen
 *  is a number the component can reason about rather than a height it has to
 *  guess at. A collapsed folder contributes its own row and nothing under it. */
function flatten(folder: TreeFolder, collapsed: ReadonlySet<string>, depth = 0): Row[] {
  const rows: Row[] = [];
  for (const child of folder.folders) {
    rows.push({ depth, kind: 'folder', name: child.name, path: child.path });
    if (!collapsed.has(child.path)) rows.push(...flatten(child, collapsed, depth + 1));
  }
  for (const name of folder.files) {
    rows.push({ depth, kind: 'file', name, path: `${folder.path}/${name}` });
  }
  return rows;
}

/** How much of a listing answers "what am I getting" before it turns into
 *  scrolling. Everything past it is one line away. */
const FIRST_GLANCE = 12;

/**
 * What's inside, truthfully: the copy's file list as a compact collapsible
 * tree. Listing only, and deliberately not a live browser — these files exist
 * in the copy, not in this window, and reading them is what taking the copy is
 * for.
 *
 * Bounded by rows rather than by height, so it never becomes a scroll region
 * inside a page that already scrolls. A long listing states how much more
 * there is and shows it on request.
 */
export function GalleryFileTree({ paths }: { paths: readonly string[] }) {
  const tree = useMemo(() => buildTree(paths), [paths]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(() => flatten(tree, collapsed), [collapsed, tree]);
  const shown = expanded ? rows : rows.slice(0, FIRST_GLANCE);
  const hidden = rows.length - shown.length;

  const toggle = (path: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (!next.delete(path)) next.add(path);
      return next;
    });

  return (
    <ul className="m-0 list-none p-0">
      {shown.map((row) =>
        row.kind === 'folder' ? (
          <li key={row.path}>
            <button
              aria-expanded={!collapsed.has(row.path)}
              className={focusRing(
                'flex h-6 w-full cursor-pointer items-center gap-1.5 rounded-md pr-2 text-left text-caption text-foreground transition-colors duration-fast outline-none hover:bg-hover',
              )}
              onClick={() => toggle(row.path)}
              style={{ paddingLeft: row.depth * 14 }}
              type="button"
            >
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  'size-3 shrink-0 text-muted-foreground transition-transform duration-fast motion-reduce:transition-none',
                  !collapsed.has(row.path) && 'rotate-90',
                )}
              />
              <Folder aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">{row.name}</span>
            </button>
          </li>
        ) : (
          <li
            className="flex h-6 items-center gap-1.5 pr-2 text-caption text-muted-foreground"
            key={row.path}
            style={{ paddingLeft: row.depth * 14 + 18 }}
          >
            <FileTypeIcon aria-hidden="true" className="size-3.5 shrink-0" path={row.name} />
            <span className="min-w-0 truncate">{row.name}</span>
          </li>
        ),
      )}
      {hidden > 0 && (
        <li>
          <button
            className={focusRing(
              'flex h-6 cursor-pointer items-center rounded-md pr-2 pl-[18px] text-caption text-muted-foreground transition-colors duration-fast outline-none hover:text-foreground',
            )}
            onClick={() => setExpanded(true)}
            type="button"
          >
            and {hidden} more
          </button>
        </li>
      )}
    </ul>
  );
}
