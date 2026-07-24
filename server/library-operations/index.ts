/**
 * Host-side operations over the user's authorized library.
 *
 * This is the semantic seam shared by the local HTTP routes and MCP. It owns
 * source identity, library membership, preparation readiness, and operation
 * errors; transports only parse and serialize requests.
 */
import { getApiKey } from '../app-config.ts';
import { isAudioTranscriptTextUnavailable } from '../audio-transcription.ts';
import { isConversionTextUnavailable } from '../conversion.ts';
import { memberFolderRoots } from '../folder.ts';
import { filesystemPath } from '../filesystem-path.ts';
import {
  normalizeLibrarySearchScope,
  requireLibraryStatusFolder,
  routeError,
} from '../library-file-access.ts';
import { listLibraryDirectory } from '../library-directory.ts';
import { readLibraryFile } from '../library-file-reader.ts';
import {
  deleteLibraryFile,
  editLibraryFile,
  moveLibraryFile,
  writeLibraryFile,
} from '../library-file-mutations.ts';
import { getLibraryInfo, type LibraryInfo } from '../library-info.ts';
import { remapSearchHitsForDisplay } from '../search-display.ts';
import { errorMessage, logger } from '../log.ts';
import { indexer, syncFolderNow } from '../state.ts';
import type { IndexStatus, SearchHit } from '../indexer.ts';
import type { SyncResult } from '../sync.ts';
import { LibraryOperationError } from './errors.ts';

export { LibraryOperationError } from './errors.ts';

const log = logger('library-operations');

export interface LibraryOperations {
  info(): Promise<LibraryInfo>;
  search(input: { query: string; topK?: number; folder?: string; pathPrefix?: string }): Promise<{ hits: SearchHit[] }>;
  reindex(input?: { folder?: string }): Promise<unknown>;
  listDirectory(path?: unknown): Promise<unknown>;
  read(path: unknown): Promise<unknown>;
  write(input: { path: unknown; content: unknown; baseVersion?: string }): Promise<unknown>;
  edit(input: { path: unknown; oldText: unknown; newText: unknown; replaceAll?: boolean; baseVersion?: string }): Promise<unknown>;
  move(input: { path: unknown; newPath: unknown; cascade?: boolean }): Promise<unknown>;
  delete(path: unknown): Promise<unknown>;
}

export interface LibraryOperationsDependencies {
  getLibraryInfo: () => LibraryInfo;
  hasEmbeddingKey: () => boolean;
  search: (query: string, topK: number, folderRoot?: string, pathPrefix?: string) => Promise<SearchHit[]>;
  remapSearchHits: (hits: SearchHit[]) => SearchHit[];
  reindexFolder: (folder: string) => Promise<SyncResult>;
  indexStatus: (folderRoot?: string) => Promise<IndexStatus>;
  memberFolderRoots: () => string[];
  listDirectory: typeof listLibraryDirectory;
  read: typeof readLibraryFile;
  write: typeof writeLibraryFile;
  edit: typeof editLibraryFile;
  move: typeof moveLibraryFile;
  delete: typeof deleteLibraryFile;
}

const productionDependencies: LibraryOperationsDependencies = {
  getLibraryInfo,
  hasEmbeddingKey: () => Boolean(getApiKey()),
  search: (query, topK, folderRoot, pathPrefix) => indexer.search(query, topK, folderRoot, pathPrefix),
  remapSearchHits: (hits) => remapSearchHitsForDisplay(
    hits.filter((hit) => {
      const fileName = typeof hit.fileName === 'string' ? hit.fileName : '';
      return !isConversionTextUnavailable(fileName) && !isAudioTranscriptTextUnavailable(fileName);
    }),
    filesystemPath.absolute(getLibraryInfo().folder_home),
  ),
  reindexFolder: (folder) => syncFolderNow(folder, { reason: 'mcp reindex' }),
  indexStatus: (folderRoot) => indexer.status(folderRoot),
  memberFolderRoots,
  listDirectory: listLibraryDirectory,
  read: readLibraryFile,
  write: writeLibraryFile,
  edit: editLibraryFile,
  move: moveLibraryFile,
  delete: deleteLibraryFile,
};

/** Build the deep library module. Tests may replace only the dependencies they exercise. */
export function createLibraryOperations(
  overrides: Partial<LibraryOperationsDependencies> = {},
): LibraryOperations {
  const deps = { ...productionDependencies, ...overrides };
  return {
    info: async () => deps.getLibraryInfo(),

    async search({ query, topK = 8, folder, pathPrefix }) {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) throw routeError('query required', 400);
      if (!deps.hasEmbeddingKey()) {
        throw routeError(
          'semantic search is disabled until you add an embedding API key',
          412,
          'EMBEDDER_KEY_REQUIRED',
        );
      }
      const scope = normalizeLibrarySearchScope(folder, pathPrefix);
      const hits = await deps.search(trimmedQuery, topK, scope.folderRoot, scope.pathPrefix);
      return { hits: deps.remapSearchHits(hits) };
    },

    async reindex({ folder } = {}) {
      const folderRoot = requireLibraryStatusFolder(folder);
      const folders: Array<Record<string, unknown>> = [];
      for (const target of folderRoot ? [folderRoot] : deps.memberFolderRoots()) {
        try {
          folders.push({ folder: target, ...await deps.reindexFolder(target) });
        } catch (err: unknown) {
          folders.push({ folder: target, error: errorMessage(err) });
        }
      }
      let status: Partial<IndexStatus> = {};
      try {
        status = await deps.indexStatus(folderRoot);
      } catch (err: unknown) {
        log.warn(`reindex status failed: ${errorMessage(err)}`);
      }
      return { folders, ...status };
    },

    listDirectory: (path) => asLibraryOperation(() => deps.listDirectory(path)),
    read: (path) => asLibraryOperation(() => deps.read(path)),
    write: ({ path, content, baseVersion }) => asLibraryOperation(() => {
      if (typeof content !== 'string') throw routeError('content (string) required', 400);
      return deps.write(path, content, { baseVersion });
    }),
    edit: ({ path, oldText, newText, replaceAll, baseVersion }) => asLibraryOperation(() => {
      if (typeof oldText !== 'string') throw routeError('old_text (string) required', 400);
      if (typeof newText !== 'string') throw routeError('new_text (string) required', 400);
      return deps.edit(path, oldText, newText, { replaceAll, baseVersion });
    }),
    move: ({ path, newPath, cascade }) => asLibraryOperation(() => deps.move(path, newPath, { cascade })),
    delete: (path) => asLibraryOperation(() => deps.delete(path)),
  };
}

async function asLibraryOperation<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error: unknown) {
    if (error instanceof LibraryOperationError) throw error;
    const code = typeof (error as { code?: unknown })?.code === 'string'
      ? (error as { code: string }).code
      : undefined;
    const status = typeof (error as { status?: unknown })?.status === 'number'
      ? (error as { status: number }).status
      : code === 'FILE_CHANGED' ? 409 : 500;
    throw new LibraryOperationError(errorMessage(error), status, code);
  }
}
