/**
 * The workspace tree's own model: the listing the server sends, the node and
 * row shapes the sidebar renders, and the path arithmetic every mutation and
 * keyboard move relies on. Format vocabulary comes from the cross-process
 * `ViewerFormat`, so the listing wire and the tree cannot drift.
 */
import type { ViewerFormat } from '@/contracts/file-formats';

export type { ViewerFormat };

type FileKind = 'regular' | 'symlink' | 'special' | 'cloud-placeholder';
type FolderKind = 'normal' | 'excluded' | 'unreadable';

export interface WorkspaceFile {
  availability: 'available' | 'unreadable';
  format: ViewerFormat;
  heading: string;
  importedAt: string;
  kind: FileKind;
  path: string;
  size: number;
  snippet: string;
}

export interface WorkspaceFolder {
  kind: FolderKind;
  path: string;
}

export interface WorkspaceListing {
  files: WorkspaceFile[];
  folderName: string;
  folders: WorkspaceFolder[];
  /** The hidden-entry visibility the server actually applied to this listing.
   *  Read back rather than assumed, so a window's menu can never disagree with
   *  the rows it is showing. */
  showHiddenFiles: boolean;
}

interface FileNode extends WorkspaceFile {
  name: string;
  type: 'file';
}

interface FolderNode extends WorkspaceFolder {
  children: TreeNode[];
  name: string;
  type: 'folder';
}

export type TreeNode = FileNode | FolderNode;

export interface TreeRow {
  depth: number;
  node: TreeNode;
  parentPath: string | null;
  position: number;
  setSize: number;
}

export type ExpandedFolders = Record<string, true>;

/** One file or folder the user can rename or delete, by folder-relative path. */
export interface WorkspaceEntry {
  kind: 'file' | 'folder';
  path: string;
}

function basename(entryPath: string): string {
  return entryPath.split('/').at(-1) ?? entryPath;
}

function parentPath(entryPath: string): string {
  return entryPath.split('/').slice(0, -1).join('/');
}

/** The folder-relative parent of an entry; empty at the folder root. */
export function parentTreePath(entryPath: string): string {
  return parentPath(entryPath);
}

export function joinTreePath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

/** The path an entry takes when only its leaf name changes. */
export function renamedTreePath(entryPath: string, name: string): string {
  return joinTreePath(parentPath(entryPath), name);
}

/** True for the entry itself and everything below it. */
export function treePathWithin(entryPath: string, prefix: string): boolean {
  return entryPath === prefix || entryPath.startsWith(`${prefix}/`);
}

/** Why a typed name cannot become an entry, or null when it can. Mirrors
 *  the wire rule so the tree explains a bad name before any request. */
export function entryNameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'Enter a name.';
  if (/[\\/]/u.test(trimmed)) return 'A name cannot contain slashes.';
  if (trimmed === '.' || trimmed === '..') return 'That name is reserved.';
  if (trimmed.length > 255) return 'That name is too long.';
  return null;
}

function compareNodes(left: TreeNode, right: TreeNode): number {
  if (left.type !== right.type) return left.type === 'folder' ? -1 : 1;
  return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });
}

export function buildTree(listing: WorkspaceListing): TreeNode[] {
  const roots: TreeNode[] = [];
  const folders = new Map<string, FolderNode>();

  const ensureFolder = (folderPath: string, kind: FolderKind = 'normal'): FolderNode => {
    const existing = folders.get(folderPath);
    if (existing) {
      if (kind !== 'normal') existing.kind = kind;
      return existing;
    }
    const node: FolderNode = {
      children: [],
      kind,
      name: basename(folderPath),
      path: folderPath,
      type: 'folder',
    };
    const parent = parentPath(folderPath);
    if (parent) ensureFolder(parent).children.push(node);
    else roots.push(node);
    folders.set(folderPath, node);
    return node;
  };

  for (const folder of listing.folders) ensureFolder(folder.path, folder.kind);
  for (const file of listing.files) {
    const node: FileNode = { ...file, name: basename(file.path), type: 'file' };
    const parent = parentPath(file.path);
    if (parent) ensureFolder(parent).children.push(node);
    else roots.push(node);
  }

  const sort = (nodes: TreeNode[]) => {
    nodes.sort(compareNodes);
    for (const node of nodes) if (node.type === 'folder') sort(node.children);
  };
  sort(roots);
  return roots;
}

export function folderIsRestricted(folder: WorkspaceFolder): boolean {
  return folder.kind === 'excluded' || folder.kind === 'unreadable';
}

export function fileIsRestricted(file: WorkspaceFile): boolean {
  return file.availability === 'unreadable' || file.kind !== 'regular';
}

export function visibleTree(nodes: TreeNode[], expanded: ExpandedFolders): TreeRow[] {
  const rows: TreeRow[] = [];
  const visit = (siblings: TreeNode[], depth: number, parent: string | null) => {
    siblings.forEach((node, index) => {
      rows.push({
        depth,
        node,
        parentPath: parent,
        position: index + 1,
        setSize: siblings.length,
      });
      if (node.type === 'folder' && !folderIsRestricted(node) && expanded[node.path] === true) {
        visit(node.children, depth + 1, node.path);
      }
    });
  };
  visit(nodes, 1, null);
  return rows;
}

export function nextTreePath(
  key: string,
  currentPath: string | null,
  rows: readonly TreeRow[],
): string | null {
  if (rows.length === 0) return null;
  const currentIndex = Math.max(
    0,
    rows.findIndex((row) => row.node.path === currentPath),
  );
  if (key === 'Home') return rows[0]?.node.path ?? null;
  if (key === 'End') return rows.at(-1)?.node.path ?? null;
  if (key === 'ArrowDown')
    return rows[Math.min(currentIndex + 1, rows.length - 1)]?.node.path ?? null;
  if (key === 'ArrowUp') return rows[Math.max(currentIndex - 1, 0)]?.node.path ?? null;
  return null;
}
