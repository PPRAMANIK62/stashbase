/**
 * Host-side operations over the user's authorized library.
 *
 * This is the semantic seam shared by the local HTTP routes and MCP. It owns
 * source identity, library membership, preparation readiness, and operation
 * errors; transports only parse and serialize requests.
 */
import { memberFolderRootsAsync } from '../folder.ts';
import {
  normalizeLibrarySearchScope,
  requireLibraryStatusFolder,
  routeError,
} from '../library-file-access.ts';
import { listLibraryDirectory } from '../library-directory.ts';
import { readLibraryFile, type LibraryFileLineRange } from '../library-file-reader.ts';
import {
  deleteLibraryFile,
  editLibraryFile,
  moveLibraryFile,
  writeLibraryFile,
} from '../library-file-mutations.ts';
import { getLibraryInfo, type LibraryInfo } from '../library-info.ts';
import { createProjectFolder } from '../agent-projects.ts';
import { errorMessage, logger } from '../log.ts';
import { indexer, syncFolderNow } from '../state.ts';
import {
  createRetrieval,
  keywordFilesFromEvidence,
  searchHitsFromEvidence,
  type Retrieval,
  type RetrievalMode,
} from '../retrieval/index.ts';
import { attributedAgentSession, attributedSessionForWindow, attributedRequestSession } from '../agent-session-registry.ts';
import type { IndexerStatus, SearchHit } from '../indexer.ts';
import type { KeywordHitFile } from '../search-display.ts';
import type { SyncResult } from '../sync.ts';
import { LibraryOperationError } from './errors.ts';
import type { SearchTypeCategory } from '../../shared/search-types.ts';
import type { LibraryKeywordFile } from '../../shared/search-results.ts';

export type { LibraryKeywordFile } from '../../shared/search-results.ts';

export { LibraryOperationError } from './errors.ts';

const log = logger('library-operations');

export interface LibraryOperations {
  info(): Promise<LibraryInfo>;
  search(input: {
    query: string;
    topK?: number;
    folder?: string;
    pathPrefix?: string;
    types?: readonly SearchTypeCategory[];
    /** Requested retrieval mode. An attributed panel session with search by
     * meaning off resolves every request to lexical retrieval. */
    mode?: RetrievalMode;
    caseStrict?: boolean;
    wholeWord?: boolean;
    /** Transport attribution, never model-controlled tool arguments. */
    agentSessionId?: string;
    windowId?: string;
  }): Promise<{ mode: RetrievalMode; folder: string; hits: SearchHit[]; truncated?: boolean }>;
  /** MFS exact search over one explicit or attributed Folder. */
  keywordSearch(input: {
    query: string;
    caseStrict?: boolean;
    wholeWord?: boolean;
    folder?: string;
    pathPrefix?: string;
  }): Promise<{ files: LibraryKeywordFile[]; totalMatches: number; truncated: boolean }>;
  reindex(input?: { folder?: string }): Promise<unknown>;
  /** Create a new project folder and register it into the library.
   * `agentSessionId` is request attribution (header-derived, never a tool
   * argument): a live library-scoped calling session is rebound to the new
   * project; folder-bound and unattributed callers only create + register. */
  createProject(input: { name: unknown; location?: unknown; agentSessionId?: string; windowId?: string }): Promise<unknown>;
  listDirectory(path?: unknown): Promise<unknown>;
  read(path: unknown, range?: LibraryFileLineRange): Promise<unknown>;
  write(input: { path: unknown; content: unknown; baseVersion?: string }): Promise<unknown>;
  edit(input: { path: unknown; oldText: unknown; newText: unknown; replaceAll?: boolean; baseVersion?: string }): Promise<unknown>;
  move(input: { path: unknown; newPath: unknown; cascade?: boolean }): Promise<unknown>;
  delete(path: unknown): Promise<unknown>;
}

export interface LibraryOperationsDependencies {
  getLibraryInfo: () => LibraryInfo;
  normalizeSearchScope: typeof normalizeLibrarySearchScope;
  retrieval: Retrieval;
  reindexFolder: (folder: string) => Promise<SyncResult>;
  indexStatus: (folderRoot?: string) => Promise<IndexerStatus>;
  memberFolderRoots: () => string[] | Promise<string[]>;
  createProject: typeof createProjectFolder;
  listDirectory: typeof listLibraryDirectory;
  read: typeof readLibraryFile;
  write: typeof writeLibraryFile;
  edit: typeof editLibraryFile;
  move: typeof moveLibraryFile;
  delete: typeof deleteLibraryFile;
  /** null means the request did not come from an attributable panel session. */
  similaritySearchEnabled: (agentSessionId?: string, windowId?: string) => boolean | null;
}

const productionDependencies: LibraryOperationsDependencies = {
  getLibraryInfo,
  normalizeSearchScope: normalizeLibrarySearchScope,
  retrieval: createRetrieval(),
  reindexFolder: (folder) => syncFolderNow(folder, { reason: 'mcp reindex' }),
  indexStatus: (folderRoot) => indexer.status(folderRoot),
  memberFolderRoots: memberFolderRootsAsync,
  createProject: createProjectFolder,
  listDirectory: listLibraryDirectory,
  read: readLibraryFile,
  write: writeLibraryFile,
  edit: editLibraryFile,
  move: moveLibraryFile,
  delete: deleteLibraryFile,
  similaritySearchEnabled: (agentSessionId, windowId) =>
    attributedRequestSession(agentSessionId, windowId)?.similaritySearchEnabled() ?? null,
};

/** Build the deep library module. Tests may replace only the dependencies they exercise. */
export function createLibraryOperations(
  overrides: Partial<LibraryOperationsDependencies> = {},
): LibraryOperations {
  const deps = { ...productionDependencies, ...overrides };
  return {
    info: async () => deps.getLibraryInfo(),

    async search({
      query,
      topK = 8,
      folder,
      pathPrefix,
      types,
      mode = 'semantic',
      caseStrict,
      wholeWord,
      agentSessionId,
      windowId,
    }) {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) throw routeError('query required', 400);
      if (folder != null && typeof folder !== 'string') throw routeError('folder must be a string', 400);
      if (pathPrefix != null && typeof pathPrefix !== 'string') throw routeError('path_prefix must be a string', 400);
      folder = folder?.trim() || undefined;
      // Scope must come from caller identity, never the app-wide sole active
      // turn: an unrelated external MCP client may search concurrently.
      const session = agentSessionId
        ? attributedAgentSession(agentSessionId)
        : attributedSessionForWindow(windowId);
      if (!session && (agentSessionId || (windowId && !folder))) {
        throw routeError('search session is no longer available or is ambiguous', 409);
      }
      const defaultFolder = session?.boundFolder() ?? undefined;
      const scope = await deps.normalizeSearchScope(folder || defaultFolder, pathPrefix);
      const similarityEnabled = deps.similaritySearchEnabled(agentSessionId, windowId);
      const effectiveMode: RetrievalMode = similarityEnabled === false ? 'keyword' : mode;
      const result = await deps.retrieval.search({
        mode: effectiveMode,
        query: trimmedQuery,
        topK,
        folderRoot: scope.folderRoot,
        pathPrefix: scope.pathPrefix,
        types,
        caseStrict,
        wholeWord,
      });
      if (result.availability.state === 'unavailable') {
        throw routeError(
          'To search by meaning, set it up in StashBase Settings.',
          412,
          'EMBEDDER_KEY_REQUIRED',
        );
      }
      return {
        mode: effectiveMode,
        folder: scope.folderRoot,
        hits: searchHitsFromEvidence(result.evidence, [scope.folderRoot]),
        ...(result.truncated ? { truncated: true } : {}),
      };
    },

    async keywordSearch({ query, caseStrict, wholeWord, folder, pathPrefix }) {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) throw routeError('query required', 400);
      const scope = await deps.normalizeSearchScope(folder, pathPrefix);
      const result = await deps.retrieval.search({
        mode: 'keyword',
        query: trimmedQuery,
        folderRoot: scope.folderRoot,
        pathPrefix: scope.pathPrefix,
        caseStrict: caseStrict === true,
        wholeWord: wholeWord === true,
      });
      const files = keywordFilesFromEvidence(result.evidence, scope.folderRoot)
        .map((file) => ({ ...file, folder: scope.folderRoot }));
      return {
        files,
        totalMatches: files.reduce((total, file) => total + file.totalMatches, 0),
        truncated: result.truncated,
      };
    },

    async reindex({ folder } = {}) {
      const folderRoot = await requireLibraryStatusFolder(folder);
      const folders: Array<Record<string, unknown>> = [];
      for (const target of folderRoot ? [folderRoot] : await deps.memberFolderRoots()) {
        try {
          folders.push({ folder: target, ...await deps.reindexFolder(target) });
        } catch (err: unknown) {
          folders.push({ folder: target, error: errorMessage(err) });
        }
      }
      let status: Partial<IndexerStatus> = {};
      try {
        status = await deps.indexStatus(folderRoot);
      } catch (err: unknown) {
        log.warn(`reindex status failed: ${errorMessage(err)}`);
      }
      return { folders, ...status };
    },

    createProject: (input) => asLibraryOperation(() => deps.createProject(input)),

    listDirectory: (path) => asLibraryOperation(() => deps.listDirectory(path)),
    read: (path, range) => asLibraryOperation(() => deps.read(path, range)),
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
