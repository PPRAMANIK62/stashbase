/**
 * Filesystem copy/move primitives shared by the folder-import path and
 * the KB-root migration path. Kept dependency-free (no app modules) so
 * both `import-folder.ts` and `space.ts` can use it without an import
 * cycle.
 *
 * Everything here dereferences symlinks (copies their targets), refuses
 * to follow directory cycles, and never overwrites — the destination
 * must not exist. Moves are copy-then-delete so they're safe across
 * filesystems, unlike `fs.rename` (which throws EXDEV across volumes).
 */
import fs from 'node:fs';
import path from 'node:path';

/** Recursively copy `source` into a fresh `destination`. Throws if the
 *  destination already exists, on a cyclic symlink, or on an
 *  unsupported entry type. Leaves a partial destination behind on
 *  failure — callers that need atomicity roll it back. */
export interface CopyDirectoryOptions {
  exclude?: (relPath: string, entry: fs.Dirent) => boolean;
}

export function copyDirectoryDereferenced(
  source: string,
  destination: string,
  opts: CopyDirectoryOptions = {},
): void {
  if (fs.existsSync(destination)) throw new Error(`destination already exists: ${destination}`);
  const sourceReal = fs.realpathSync(source);
  const sourceStat = fs.statSync(source);
  fs.mkdirSync(destination, { recursive: false, mode: sourceStat.mode });

  const stack: Array<{ source: string; destination: string; rel: string; ancestors: Set<string> }> = [
    { source, destination, rel: '', ancestors: new Set([sourceReal]) },
  ];
  while (stack.length > 0) {
    const frame = stack.pop()!;
    for (const entry of fs.readdirSync(frame.source, { withFileTypes: true })) {
      const childRel = frame.rel ? `${frame.rel}/${entry.name}` : entry.name;
      if (opts.exclude?.(childRel, entry)) continue;
      const childSource = path.join(frame.source, entry.name);
      const childDestination = path.join(frame.destination, entry.name);
      const stat = fs.statSync(childSource);
      if (stat.isDirectory()) {
        const real = fs.realpathSync(childSource);
        if (frame.ancestors.has(real)) throw new Error(`cyclic symlink detected: ${childSource}`);
        fs.mkdirSync(childDestination, { mode: stat.mode });
        stack.push({
          source: childSource,
          destination: childDestination,
          rel: childRel,
          ancestors: new Set([...frame.ancestors, real]),
        });
        continue;
      }
      if (stat.isFile()) {
        fs.copyFileSync(childSource, childDestination, fs.constants.COPYFILE_EXCL);
        fs.chmodSync(childDestination, stat.mode);
        continue;
      }
      throw new Error(`unsupported filesystem entry: ${childSource}`);
    }
  }
}

/** Move a directory by safe copy + delete (cross-filesystem safe). The
 *  destination must not exist — overwrite/rename policies are the
 *  caller's job. Two phases mirror the folder-import logic:
 *
 *  1. Copy. If anything throws, roll back the partial destination and
 *     rethrow — the source is untouched, so nothing is lost.
 *  2. Delete the source. This is *outside* the rollback: the copy is
 *     already committed, so a delete failure must keep the destination.
 *     We surface a warning instead so the caller can tell the user the
 *     original still needs manual cleanup. */
export function moveDirectory(source: string, destination: string): { warning?: string } {
  try {
    copyDirectoryDereferenced(source, destination);
  } catch (err) {
    try { fs.rmSync(destination, { recursive: true, force: true }); } catch { /* best-effort rollback */ }
    throw err;
  }
  try {
    fs.rmSync(source, { recursive: true, force: false });
  } catch {
    // The copy succeeded, so ${destination} is the complete, authoritative
    // copy. The source delete failed partway, so ${source} may now be
    // partially emptied — redundant either way and safe to remove by hand;
    // we don't retry here to avoid thrashing a half-deleted tree.
    return {
      warning: `Copied into ${destination} (that copy is complete). The original at ${source} couldn't be fully removed and may be partially deleted — it's now redundant; delete it manually.`,
    };
  }
  return {};
}
