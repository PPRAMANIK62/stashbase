import path from 'node:path';
import { memberFolderRoots, runWithFolderRoot } from './folder.ts';
import { filesystemPath } from './filesystem-path.ts';
import { listImmediateDirectory } from './files.ts';
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
    let entries: ReturnType<typeof listImmediateDirectory>;
    try { entries = listImmediateDirectory(prefix); }
    catch { throw routeError('directory not found', 404); }
    return {
      path: target.abs ?? folderRoot,
      entries: entries.map((entry): LibraryDirectoryEntry => ({
        ...entry,
        path: filesystemPath.join(folderRoot, entry.path),
      })),
    };
  });
}
