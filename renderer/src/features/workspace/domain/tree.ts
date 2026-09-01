export type FileFormat =
  | 'md'
  | 'html'
  | 'json'
  | 'txt'
  | 'pdf'
  | 'image'
  | 'docx'
  | 'audio'
  | 'generic';

export type FileKind = 'regular' | 'symlink' | 'special' | 'cloud-placeholder';
export type FolderKind = 'normal' | 'excluded' | 'unreadable';

export interface WorkspaceFile {
  availability: 'available' | 'unreadable';
  format: FileFormat;
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
}

export interface FileNode extends WorkspaceFile {
  name: string;
  type: 'file';
}

export interface FolderNode extends WorkspaceFolder {
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

function basename(entryPath: string): string {
  return entryPath.split('/').at(-1) ?? entryPath;
}

function parentPath(entryPath: string): string {
  return entryPath.split('/').slice(0, -1).join('/');
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
  rows: TreeRow[],
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
