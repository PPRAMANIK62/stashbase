import path from 'node:path';
import { memberFolderRoots, runWithFolderRoot } from './folder.ts';
import { filesystemPath } from './filesystem-path.ts';
import { fileVersion, listFiles, listFolders } from './files.ts';
import {
  normalizeLibraryDirectoryPath,
  routeError,
  type LibraryDirectoryEntry,
} from './library-file-access.ts';

export async function listLibraryDirectory(rawPath: unknown): Promise<{ path: string; entries: LibraryDirectoryEntry[] }> {
  const target = normalizeLibraryDirectoryPath(rawPath);
  if (!target.folderRoot) {
    return {
      path: '',
      entries: memberFolderRoots()
        .map((root) => ({ name: path.basename(root), path: root, type: 'directory' as const }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }
  const folderRoot = target.folderRoot;
  return runWithFolderRoot(folderRoot, async () => {
    const prefix = target.folderRel ? target.folderRel.replace(/\/+$/, '') : '';
    if (prefix && !folderExists(prefix)) throw routeError('directory not found', 404);
    const children = new Map<string, LibraryDirectoryEntry>();
    for (const folder of listFolders()) {
      const child = immediateChild(prefix, folder.path);
      if (!child) continue;
      children.set(`d:${child.path}`, {
        name: child.name,
        path: filesystemPath.join(folderRoot, child.path),
        type: 'directory',
      });
    }
    for (const file of listFiles()) {
      const child = immediateFileChild(prefix, file.name);
      if (!child) continue;
      children.set(`f:${child.path}`, {
        name: child.name,
        path: filesystemPath.join(folderRoot, child.path),
        type: 'file',
        format: file.format,
        size: file.size,
        version: fileVersion(file.name) ?? undefined,
      });
    }
    return {
      path: target.abs ?? folderRoot,
      entries: [...children.values()].sort((a, b) =>
        a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1,
      ),
    };
  });
}

function folderExists(folderRel: string): boolean {
  try {
    return listFolders().some((folder) => folder.path === folderRel);
  } catch {
    return false;
  }
}

function immediateChild(prefix: string, relPath: string): { name: string; path: string } | null {
  if (prefix) {
    if (relPath === prefix || !relPath.startsWith(prefix + '/')) return null;
    relPath = relPath.slice(prefix.length + 1);
  }
  const first = relPath.split('/')[0];
  if (!first) return null;
  return {
    name: first,
    path: prefix ? `${prefix}/${first}` : first,
  };
}

function immediateFileChild(prefix: string, relPath: string): { name: string; path: string } | null {
  const child = immediateChild(prefix, relPath);
  if (!child) return null;
  return child.path === relPath ? child : null;
}
