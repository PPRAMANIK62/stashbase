/**
 * Space sync: reconcile the index with whatever note files are
 * currently on disk in the space.
 *
 * Two flavours:
 *
 *   - `syncIndex`     — full content-hash diff via the daemon's
 *                       `scan_diff` op. Catches external edits done
 *                       behind StashBase's back (vim / git checkout /
 *                       Dropbox). Called by the fs.watch debounce
 *                       (something actually changed) and by the
 *                       manual `POST /api/sync` button.
 *
 *   - `syncNewFiles`  — name-only diff via `indexer.status()`.
 *                       Embeds files not yet in the index, drops
 *                       orphans, but **does not re-embed** existing
 *                       rows even if their content drifted. Used on
 *                       app startup / space-switch so re-opening a
 *                       fully-indexed space costs zero embed tokens.
 *                       Trade-off: a `vim` edit made while the app
 *                       was closed won't be picked up until the user
 *                       clicks the sync button.
 */
import { readText } from './files.ts';
import { getCurrentSpace } from './space.ts';
import type { Indexer } from './indexer.ts';
import { logger, errorMessage } from './log.ts';

const log = logger('sync');

export interface SyncResult {
  added: string[];
  modified: string[];
  removed: string[];
  failed: { name: string; error: string }[];
}

export async function syncIndex(indexer: Indexer): Promise<SyncResult> {
  const spaceRoot = getCurrentSpace();
  if (!spaceRoot) {
    log.info('no space open, skipping');
    return { added: [], modified: [], removed: [], failed: [] };
  }

  const diff = await indexer.syncDiff(spaceRoot);
  const failed: { name: string; error: string }[] = [];

  if (diff.added.length === 0 && diff.modified.length === 0 && diff.deleted.length === 0) {
    log.info('index up to date');
    return { added: [], modified: [], removed: [], failed: [] };
  }

  if (diff.deleted.length) {
    log.info(`removing ${diff.deleted.length} stale file(s) from index`);
    for (const name of diff.deleted) {
      try { await indexer.deleteFile(name); }
      catch (err: any) { failed.push({ name, error: errorMessage(err) }); }
    }
  }

  const toIndex = [...diff.added, ...diff.modified];
  if (toIndex.length) {
    log.info(
      `indexing ${toIndex.length} file(s) ` +
        `(${diff.added.length} new, ${diff.modified.length} drift-detected)`,
    );
  }
  const addedDone: string[] = [];
  const modifiedDone: string[] = [];
  for (const name of diff.added) {
    if (await indexOne(indexer, name, failed)) addedDone.push(name);
  }
  for (const name of diff.modified) {
    if (await indexOne(indexer, name, failed)) modifiedDone.push(name);
  }

  log.info(
    `done. added=${addedDone.length}/${diff.added.length} ` +
      `modified=${modifiedDone.length}/${diff.modified.length} ` +
      `removed=${diff.deleted.length} failed=${failed.length}`,
  );
  return {
    added: addedDone,
    modified: modifiedDone,
    removed: diff.deleted,
    failed,
  };
}

export async function syncNewFiles(indexer: Indexer): Promise<SyncResult> {
  const spaceRoot = getCurrentSpace();
  if (!spaceRoot) {
    log.info('no space open, skipping');
    return { added: [], modified: [], removed: [], failed: [] };
  }

  const status = await indexer.status(spaceRoot);
  if (status.pending.length === 0 && status.orphaned.length === 0) {
    log.info('index up to date (name-only check)');
    return { added: [], modified: [], removed: [], failed: [] };
  }

  const failed: { name: string; error: string }[] = [];

  if (status.orphaned.length) {
    log.info(`removing ${status.orphaned.length} orphan(s) from index`);
    for (const name of status.orphaned) {
      try { await indexer.deleteFile(name); }
      catch (err: any) { failed.push({ name, error: errorMessage(err) }); }
    }
  }

  if (status.pending.length) {
    log.info(`indexing ${status.pending.length} new file(s) [hash check skipped — call POST /api/sync for full re-check]`);
  }
  const addedDone: string[] = [];
  for (const name of status.pending) {
    if (await indexOne(indexer, name, failed)) addedDone.push(name);
  }

  log.info(
    `done. added=${addedDone.length}/${status.pending.length} ` +
      `removed=${status.orphaned.length} failed=${failed.length}`,
  );
  return {
    added: addedDone,
    modified: [],
    removed: status.orphaned,
    failed,
  };
}

async function indexOne(
  indexer: Indexer,
  name: string,
  failed: { name: string; error: string }[],
): Promise<boolean> {
  const content = readText(name);
  if (content == null) {
    failed.push({ name, error: 'read returned null' });
    return false;
  }
  try {
    await indexer.upsertFile(name, content);
    return true;
  } catch (err: any) {
    const msg = errorMessage(err);
    failed.push({ name, error: msg });
    log.warn(`failed ${name}: ${msg}`);
    return false;
  }
}
