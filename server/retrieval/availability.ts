import fs from 'node:fs/promises';
import { currentPreparedTextPathAsync, preparedTextCandidatePath } from '../conversion-dispatch.ts';
import { filesystemPath } from '../filesystem-path.ts';
import { isRetrievalEligiblePath, MAX_INDEXABLE_BYTES } from '../indexable.ts';
import { detectFormat } from '../format.ts';
import { analyzeHtml } from '../html.ts';
import type { SourceEvidence } from './evidence.ts';

/** Index rows can outlive a source or its preparation; check the visible source. */
export async function sourceAvailable(source: string, folderRoot: string): Promise<boolean> {
  try {
    const relative = await filesystemPath.relativeAsync(folderRoot, source);
    if (!relative || !isRetrievalEligiblePath(relative)) return false;
    const resolved = await filesystemPath.resolveUnderAsync(folderRoot, relative, { access: 'existing' });
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) return false;
    const candidate = preparedTextCandidatePath(resolved);
    if (!candidate) {
      // A failed index removal must not keep a cleared or oversized source
      // searchable. Check current source text, including after a restart.
      if (!detectFormat(resolved) || stat.size === 0 || stat.size > MAX_INDEXABLE_BYTES) return false;
      const content = await fs.readFile(resolved, 'utf8');
      return (detectFormat(resolved) === 'html' ? analyzeHtml(content).plaintext : content).trim().length > 0;
    }
    const derived = await fs.stat(candidate);
    return !!await currentPreparedTextPathAsync(resolved, resolved, {
      sourceMtimeMs: stat.mtimeMs,
      derivedMtimeMs: derived.mtimeMs,
    });
  } catch {
    return false;
  }
}

export async function availableEvidence(
  evidence: SourceEvidence[],
  folderRoot: string,
  available: typeof sourceAvailable,
): Promise<SourceEvidence[]> {
  const sources = [...new Set(evidence.map((item) => item.sourcePath))];
  const allowed = new Set<string>();
  // Bound filesystem/validation work and check each source once per request.
  for (let offset = 0; offset < sources.length; offset += 16) {
    await Promise.all(sources.slice(offset, offset + 16).map(async (source) => {
      if (await available(source, folderRoot)) allowed.add(source);
    }));
  }
  return evidence.filter((item) => allowed.has(item.sourcePath));
}
