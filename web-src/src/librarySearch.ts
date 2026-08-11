/**
 * Pure logic for the library search popup: scope model, cross-open memory,
 * and absolute→(folder, relative) result-path mapping.
 *
 * The popup remembers its last query and results across close/reopen AND
 * across folder switches, so none of this state may live in the reducer —
 * both `folderScopedResetActions` and the `FILES_LOADED` folder-change
 * branch wipe folder-scoped fields on every switch. Module-scope memory is
 * the same deliberate choice as the command palette's recent-command list.
 */
import type { FileMeta, LibraryKeywordFile, LibraryKeywordSearchResult, SearchHit } from './api';

export type LibrarySearchMode = 'semantic' | 'keyword';

/** The whole library, or the window's active folder (optionally narrowed to
 *  one of its subfolders). Folder scope always means the folder that is
 *  active when the search runs, so a remembered folder scope re-targets
 *  naturally after a cross-folder open. */
export type LibrarySearchScope =
  | { kind: 'library' }
  | { kind: 'folder'; subfolder: string | null };

export interface LibrarySemanticHit extends SearchHit {
  /** Absolute member folder root the hit lives in. */
  folder: string;
  /** Folder-relative source path — the identity the app opens. */
  rel: string;
}

export interface LibrarySearchResults {
  semanticHits: LibrarySemanticHit[] | null;
  keywordResult: LibraryKeywordSearchResult | null;
  error: string | null;
}

export interface LibrarySearchMemory extends LibrarySearchResults {
  query: string;
  mode: LibrarySearchMode;
  caseStrict: boolean;
  wholeWord: boolean;
  scope: LibrarySearchScope;
}

export interface LibrarySearchPrefill {
  query?: string;
  mode?: LibrarySearchMode;
  caseStrict?: boolean;
  wholeWord?: boolean;
  scope?: LibrarySearchScope;
}

const defaultMemory: LibrarySearchMemory = {
  query: '',
  mode: 'semantic',
  caseStrict: false,
  wholeWord: false,
  scope: { kind: 'library' },
  semanticHits: null,
  keywordResult: null,
  error: null,
};

let memory: LibrarySearchMemory = defaultMemory;

export function readLibrarySearchMemory(): LibrarySearchMemory {
  return memory;
}

export function writeLibrarySearchMemory(patch: Partial<LibrarySearchMemory>): LibrarySearchMemory {
  memory = { ...memory, ...patch };
  return memory;
}

/** Merge an open-request prefill (FindBar's "search all files" handoff) into
 *  remembered state. A new query invalidates the remembered results. */
export function applyLibrarySearchPrefill(
  base: LibrarySearchMemory,
  prefill: LibrarySearchPrefill | null | undefined,
): LibrarySearchMemory {
  if (!prefill) return base;
  return {
    ...base,
    ...(prefill.query !== undefined
      ? { query: prefill.query, semanticHits: null, keywordResult: null, error: null }
      : {}),
    ...(prefill.mode !== undefined ? { mode: prefill.mode } : {}),
    ...(prefill.caseStrict !== undefined ? { caseStrict: prefill.caseStrict } : {}),
    ...(prefill.wholeWord !== undefined ? { wholeWord: prefill.wholeWord } : {}),
    ...(prefill.scope !== undefined ? { scope: prefill.scope } : {}),
  };
}

/** Test seam. */
export function resetLibrarySearchMemory(): void {
  memory = defaultMemory;
}

/** Same normalization contract as `folderRefsEqual`: fold separators, strip
 *  trailing slashes, case-fold only Windows drive/UNC paths. Lowercasing
 *  preserves length, so a prefix index into the folded key is also a valid
 *  index into the unfolded path. */
function pathKey(value: string): { key: string; windows: boolean } {
  let key = value.trim().replace(/\\/g, '/');
  const windows = /^[A-Za-z]:\//.test(key) || key.startsWith('//');
  if (key.length > 1 && key.endsWith('/')) key = key.replace(/\/+$/, '');
  return { key: windows ? key.toLowerCase() : key, windows };
}

/** Map an absolute library path onto the member folder that contains it.
 *  Longest root wins so nested member folders resolve to the deepest one.
 *  Returns null when the path is outside every known folder (stale hit
 *  after a library change — the caller drops it). */
export function splitLibraryPath(
  absPath: string,
  folderRoots: readonly string[],
): { folder: string; rel: string } | null {
  const target = pathKey(absPath);
  let best: { folder: string; rel: string; rootLength: number } | null = null;
  for (const root of folderRoots) {
    const candidate = pathKey(root);
    if (candidate.windows !== target.windows) continue;
    if (!target.key.startsWith(candidate.key + '/')) continue;
    if (best && candidate.key.length <= best.rootLength) continue;
    const normalized = absPath.trim().replace(/\\/g, '/').replace(/\/+$/, '');
    best = {
      folder: root,
      rel: normalized.slice(candidate.key.length + 1),
      rootLength: candidate.key.length,
    };
  }
  return best ? { folder: best.folder, rel: best.rel } : null;
}

/** Attach (folder, rel) identities to raw absolute-path semantic hits,
 *  dropping any hit the current member list cannot place. */
export function resolveSemanticHits(
  hits: readonly SearchHit[],
  folderRoots: readonly string[],
): LibrarySemanticHit[] {
  const out: LibrarySemanticHit[] = [];
  for (const hit of hits) {
    const split = splitLibraryPath(hit.fileName, folderRoots);
    if (split) out.push({ ...hit, folder: split.folder, rel: split.rel });
  }
  return out;
}

/** Stable ordering for keyword file groups: the active folder's files first
 *  (they are the likeliest target), other folders keep the server's member
 *  order. */
export function orderKeywordFiles(
  files: readonly LibraryKeywordFile[],
  activeFolderPath: string,
): LibraryKeywordFile[] {
  if (!activeFolderPath) return [...files];
  const active: LibraryKeywordFile[] = [];
  const rest: LibraryKeywordFile[] = [];
  for (const file of files) {
    (pathKey(file.folder).key === pathKey(activeFolderPath).key ? active : rest).push(file);
  }
  return [...active, ...rest];
}

export function folderBasename(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const segments = normalized.split('/');
  return segments[segments.length - 1] || normalized;
}

/** Every directory that contains a visible file, folder-relative, sorted so
 *  children always follow their parent (segment-wise compare — a plain
 *  localeCompare would let "docs old" split "docs" from "docs/api" and break
 *  the scope menu's hierarchy-by-indentation). Derived from the live file
 *  list so the options always reflect the current tree. */
export function subfolderScopes(files: readonly FileMeta[]): string[] {
  const dirs = new Set<string>();
  for (const file of files) {
    const parts = file.name.split('/');
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i).join('/'));
    }
  }
  return [...dirs].sort(comparePathSegments);
}

function comparePathSegments(a: string, b: string): number {
  const left = a.split('/');
  const right = b.split('/');
  const shared = Math.min(left.length, right.length);
  for (let i = 0; i < shared; i++) {
    const cmp = left[i].localeCompare(right[i]);
    if (cmp !== 0) return cmp;
  }
  return left.length - right.length;
}
