import { promises as fs } from 'node:fs';
import { currentPreparedTextPathAsync, preparedTextCandidatePath } from './conversion-dispatch.ts';
import { isConvertibleSource } from './format.ts';
import { filesystemPath } from './filesystem-path.ts';
import { MAX_INDEXABLE_BYTES, shouldIndexFilePath } from './indexable.ts';
import type { SyncDiff } from './indexer.ts';

/** Server-owned tuning knobs. Crossing either boundary requires a decision. */
export const LARGE_SEMANTIC_SOURCE_THRESHOLD = 1_000;
export const LARGE_SEMANTIC_BYTES_THRESHOLD = 100 * 1024 * 1024;

export interface SemanticWorkloadEstimate {
  sourceCount: number;
  estimatedBytes: number;
  large: boolean;
}

/** Estimate only added/changed sources from the authoritative daemon diff.
 * Renames are deliberately absent because their embeddings are hash-reused. */
const METADATA_CONCURRENCY = 16;

export async function estimateSemanticWorkload(root: string, diff: SyncDiff): Promise<SemanticWorkloadEstimate> {
  const candidates = [...diff.added, ...diff.modified].filter((sourcePath) => {
    const rel = filesystemPath.relative(root, sourcePath);
    if (!rel) return false;
    if (isConvertibleSource(rel)) return true;
    return shouldIndexFilePath(rel);
  });
  const modified = new Set(diff.modified.map((sourcePath) => filesystemPath.identity(sourcePath)));
  let cursor = 0;
  let sourceCount = 0;
  let estimatedBytes = 0;
  async function worker(): Promise<void> {
    while (cursor < candidates.length) {
      const sourcePath = candidates[cursor++];
      const rel = filesystemPath.relative(root, sourcePath);
      if (rel && isConvertibleSource(rel)) {
        const preparedPath = preparedTextCandidatePath(sourcePath, rel);
        try {
          const sourceStat = await fs.stat(sourcePath);
          if (!sourceStat.isFile()) continue;
          sourceCount += 1;
          // A content-hash diff is stronger authority than timestamps. Never
          // price an old representation for a byte-modified source, even if a
          // sync client preserved or moved its mtime backwards.
          if (modified.has(filesystemPath.identity(sourcePath))) continue;
          if (!preparedPath) continue;
          const preparedStat = await fs.stat(preparedPath);
          const currentPath = await currentPreparedTextPathAsync(sourcePath, rel, {
            sourceMtimeMs: sourceStat.mtimeMs,
            derivedMtimeMs: preparedStat.mtimeMs,
          });
          if (currentPath) estimatedBytes += preparedStat.size;
        } catch { /* unavailable or stale preparation contributes no known text */ }
        continue;
      }
      try {
        const sourceStat = await fs.stat(sourcePath);
        if (!sourceStat.isFile() || sourceStat.size === 0 || sourceStat.size > MAX_INDEXABLE_BYTES) continue;
        sourceCount += 1;
        estimatedBytes += sourceStat.size;
      }
      catch { /* disappeared after scan */ }
    }
  }
  await Promise.all(Array.from(
    { length: Math.min(METADATA_CONCURRENCY, candidates.length) },
    () => worker(),
  ));
  return {
    sourceCount,
    estimatedBytes,
    large: sourceCount >= LARGE_SEMANTIC_SOURCE_THRESHOLD
      || estimatedBytes >= LARGE_SEMANTIC_BYTES_THRESHOLD,
  };
}
