/**
 * Per-space manual sidebar ordering.
 *
 * Source: `<space>/.stashbase/file-order.json` — a map from
 *   parent path (space-relative, `""` = root)
 * to
 *   ordered list of child basenames (files OR folders).
 *
 * Only parents the user has explicitly rearranged appear in the file.
 * For other parents the renderer falls back to the default sort
 * (folders-first + alphabetical). Names that no longer exist on disk
 * are silently dropped on read, so renamed / deleted entries don't
 * pollute the file; we don't try to follow renames through here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { logger, errorMessage, errorCode } from './log.ts';
import { requireCurrentSpace } from './space.ts';

const log = logger('file-order');

const FILE = '.stashbase/file-order.json';

export type FileOrderMap = Record<string, string[]>;

function configPath(root: string): string {
  return path.join(root, FILE);
}

/** Read the full map. Returns `{}` if the file doesn't exist or is
 *  corrupt — never throws, since the sidebar must still render. */
export function readFileOrder(): FileOrderMap {
  let root: string;
  try { root = requireCurrentSpace(); } catch { return {}; }
  try {
    const raw = fs.readFileSync(configPath(root), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: FileOrderMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k !== 'string') continue;
      if (!Array.isArray(v)) continue;
      const names = v.filter((s): s is string => typeof s === 'string');
      if (names.length === 0) continue;
      out[k] = names;
    }
    return out;
  } catch (err: any) {
    if (errorCode(err) !== 'ENOENT') {
      log.warn(`failed to read file-order.json: ${errorMessage(err)}`);
    }
    return {};
  }
}

/** Replace one parent's ordered list. Drops the entry entirely when
 *  `names` is empty (avoids accumulating stale keys). Atomic write
 *  via `.tmp` + rename. */
export function setFolderOrder(parentPath: string, names: string[]): void {
  const root = requireCurrentSpace();
  const map = readFileOrder();
  if (names.length === 0) {
    delete map[parentPath];
  } else {
    map[parentPath] = names.slice();
  }
  const target = configPath(root);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(map, null, 2), 'utf8');
  fs.renameSync(tmp, target);
}
