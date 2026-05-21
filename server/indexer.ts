/**
 * Indexer abstraction — the only surface the rest of the server is
 * allowed to import. Concrete impl currently `MfsIndexer` (sidecar
 * Python over stdio). Switching to a native TS MFS package (when
 * upstream ships one) means writing a new class behind this interface
 * and changing one import line in `index.ts`.
 *
 * Paths on every method are **kbRoot-relative POSIX**
 * (e.g. `cs183b/lecture-01.md`). The first path segment is the space
 * name. Server modules that operate in space-relative terms translate
 * at the indexer boundary — see `server/space.ts:toKbRel` /
 * `fromKbRel`.
 */

export interface SearchHit {
  /** kbRoot-relative POSIX path (e.g. `cs183b/lecture-01.md`). */
  fileName: string;
  chunkIndex: number;
  /** Indexed chunk body — already heading-prefixed for markdown / html. */
  content: string;
  /** Heading breadcrumb (`A › B › C`), or empty if the chunker didn't tag one. */
  heading: string;
  /** 1-based source-line offsets — useful for "jump to line N" UX. */
  startLine?: number;
  endLine?: number;
  /** Hybrid (RRF) score, higher = better. Scale is opaque; compare within a single response only. */
  score: number;
}

export interface EmbedderRuntimeConfig {
  provider: 'onnx' | 'openai';
  /** API key for hosted providers. Required for `openai`. */
  apiKey?: string;
  /** Optional override; impls have sensible defaults per provider. */
  model?: string;
  /** Optional override; if omitted the impl uses the provider's default. */
  dimension?: number;
}

export interface Indexer {
  /** Bind a space to its embedder provider. Determines which collection
   *  new files under this space land in. Idempotent — safe to call on
   *  every server start for every known space, and after a daemon
   *  respawn (the impl re-issues the underlying op on reconnect). */
  bindSpace(space: string, cfg: EmbedderRuntimeConfig): Promise<void>;

  /** Stop routing new files for the space. Existing rows stay
   *  searchable until explicit delete. */
  unbindSpace(space: string): Promise<void>;

  /** Insert / replace all chunks for one file. Empty content is valid —
   *  the file disappears from the index but no error is raised. */
  upsertFile(path: string, content: string): Promise<void>;

  /** Drop all chunks for one file. Safe to call on a never-indexed file. */
  deleteFile(path: string): Promise<void>;

  /** Drop all chunks for every file whose path starts with `prefix/`.
   *  Used by recursive folder-delete to clear the index in one shot. */
  deletePathPrefix(prefix: string): Promise<void>;

  /** Move a file in the index. `content` is the (unchanged) body — the
   *  impl may or may not re-embed depending on the backend. The MFS
   *  impl does a full re-embed (no in-place source update upstream). */
  renameFile(oldPath: string, newPath: string, content: string): Promise<void>;

  /** Move every file under `oldPrefix` to `newPrefix`. `files` carries
   *  the bodies under the OLD paths. The MFS impl deletes every
   *  old-prefix row and re-embeds each file. */
  renamePathPrefix(
    oldPrefix: string,
    newPrefix: string,
    files: Array<{ path: string; content: string }>,
  ): Promise<void>;

  /** Hybrid search. `space?` scopes to one space (its kbRoot-relative
   *  dirname); omitted = whole library. Returns at most `topK` hits
   *  ordered by descending score, with `fileName` kbRoot-relative. */
  search(query: string, topK: number, space?: string): Promise<SearchHit[]>;

  /** Walk the library and compute the content-hash diff against the
   *  index. `space?` scopes the walk; omitted = whole library. Paths
   *  in the returned lists are kbRoot-relative. */
  syncDiff(space?: string): Promise<SyncDiff>;

  /** Lightweight progress check — name-set diff only, no hashing.
   *  `space?` scopes; omitted = whole library. */
  status(space?: string): Promise<IndexStatus>;

  /** Release the Milvus Lite locks so the server can move / wipe the
   *  underlying DB file. Next op reopens lazily via `bindSpace`. */
  closeStore(): Promise<void>;

  /** Shut down underlying resources. Currently called only on process exit. */
  close(): Promise<void>;
}

export interface SyncDiff {
  /** On disk, not yet in the index. kbRoot-relative paths. */
  added: string[];
  /** In both, but content hash differs — likely an external edit. */
  modified: string[];
  /** In the index, gone from disk. */
  deleted: string[];
}

export interface IndexStatus {
  /** Files on disk that look indexable. */
  total: number;
  /** Files on disk that already have rows in the index. */
  indexed: number;
  /** How many files are still waiting to be indexed. */
  pendingCount: number;
  /** Full list of kbRoot-relative paths waiting to be indexed. */
  pending: string[];
  /** Files in the index that no longer exist on disk. Usually 0. */
  orphanedCount: number;
  /** Full list of orphaned kbRoot-relative paths. */
  orphaned: string[];
  /** True iff pending = 0 and orphaned = 0. */
  upToDate: boolean;
  /** False while the indexer is still loading its indexed-file cache. */
  indexReady?: boolean;
  /** PDFs currently being converted to a readable note + bundle. */
  pendingConversions?: string[];
}
