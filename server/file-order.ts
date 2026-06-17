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
 * (folders-first + alphabetical). Invalid/corrupt entries are dropped
 * on read; rename/delete routes keep valid order entries in lockstep
 * with disk mutations so a manually-arranged sidebar survives reloads.
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
      let parent: string;
      try { parent = normalizeParentPath(k); } catch { continue; }
      const names = uniqueNames(v.filter((s): s is string => typeof s === 'string')
        .map((s) => {
          try { return normalizeChildName(s); } catch { return null; }
        })
        .filter((s): s is string => s != null));
      if (names.length === 0) continue;
      out[parent] = names;
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
  const parent = normalizeParentPath(parentPath);
  const cleanNames = uniqueNames(names.map(normalizeChildName));
  if (cleanNames.length === 0) {
    delete map[parent];
  } else {
    map[parent] = cleanNames;
  }
  writeOrderMap(root, map);
}

export function remapFileOrderPath(oldRel: string, newRel: string, kind: 'file' | 'folder'): void {
  const root = requireCurrentSpace();
  const oldPath = normalizeEntryPath(oldRel);
  const newPath = normalizeEntryPath(newRel);
  if (oldPath === newPath) return;
  const map = readFileOrder();
  const next: FileOrderMap = {};
  let changed = false;

  for (const [parent, names] of Object.entries(map)) {
    const remappedParent = kind === 'folder' ? remapPath(parent, oldPath, newPath) : parent;
    const existing = next[remappedParent] ?? [];
    next[remappedParent] = uniqueNames([...existing, ...names]);
    if (remappedParent !== parent) changed = true;
  }

  const oldSplit = splitPath(oldPath);
  const newSplit = splitPath(newPath);
  const oldList = next[oldSplit.parent] ?? [];
  const oldIdx = oldList.indexOf(oldSplit.base);
  if (oldIdx >= 0) {
    const replacement = oldSplit.parent === newSplit.parent ? newSplit.base : null;
    next[oldSplit.parent] = replaceOrRemove(oldList, oldSplit.base, replacement);
    changed = true;
    if (oldSplit.parent !== newSplit.parent) {
      const target = next[newSplit.parent] ?? [];
      if (!target.includes(newSplit.base)) {
        next[newSplit.parent] = [...target, newSplit.base];
      }
    }
  }

  const cleaned = cleanMap(next);
  if (changed || JSON.stringify(cleaned) !== JSON.stringify(map)) writeOrderMap(root, cleaned);
}

export function removeFileOrderPath(relPath: string, kind: 'file' | 'folder'): void {
  const root = requireCurrentSpace();
  const target = normalizeEntryPath(relPath);
  const targetSplit = splitPath(target);
  const map = readFileOrder();
  const next: FileOrderMap = {};
  let changed = false;

  for (const [parent, names] of Object.entries(map)) {
    if (kind === 'folder' && (parent === target || parent.startsWith(target + '/'))) {
      changed = true;
      continue;
    }
    const without = parent === targetSplit.parent
      ? names.filter((n) => n !== targetSplit.base)
      : names;
    if (without.length !== names.length) changed = true;
    next[parent] = without;
  }

  const cleaned = cleanMap(next);
  if (changed || JSON.stringify(cleaned) !== JSON.stringify(map)) writeOrderMap(root, cleaned);
}

function writeOrderMap(root: string, map: FileOrderMap): void {
  const cleaned = cleanMap(map);
  const target = configPath(root);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cleaned, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, target);
}

function normalizeParentPath(value: string): string {
  if (typeof value !== 'string') throw new Error('parent path required');
  if (value === '') return '';
  return normalizeEntryPath(value);
}

function normalizeEntryPath(value: string): string {
  if (typeof value !== 'string') throw new Error('path required');
  if (value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || value.includes('\\')) {
    throw new Error('path must be space-relative POSIX path');
  }
  const norm = value.replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
  if (!norm) throw new Error('empty path');
  if (/[\x00-\x1f'"]/.test(norm)) throw new Error('invalid path (control chars / quotes not allowed)');
  for (const seg of norm.split('/')) normalizeChildName(seg);
  return norm;
}

function normalizeChildName(value: string): string {
  if (typeof value !== 'string') throw new Error('child name required');
  const name = value.normalize('NFC');
  if (!name || name.includes('/') || name.includes('\\')) throw new Error('invalid child name');
  if (/[\x00-\x1f'"]/.test(name)) throw new Error('invalid child name');
  if (name === '.' || name === '..') throw new Error('invalid child name');
  return name;
}

function splitPath(relPath: string): { parent: string; base: string } {
  const i = relPath.lastIndexOf('/');
  return i < 0 ? { parent: '', base: relPath } : { parent: relPath.slice(0, i), base: relPath.slice(i + 1) };
}

function remapPath(pathValue: string, from: string, to: string): string {
  if (!pathValue) return pathValue;
  if (pathValue === from) return to;
  if (pathValue.startsWith(from + '/')) return to + pathValue.slice(from.length);
  return pathValue;
}

function replaceOrRemove(names: string[], oldName: string, newName: string | null): string[] {
  const out: string[] = [];
  for (const name of names) {
    if (name === oldName) {
      if (newName && !out.includes(newName)) out.push(newName);
    } else if (!out.includes(name)) {
      out.push(name);
    }
  }
  return out;
}

function uniqueNames(names: string[]): string[] {
  return [...new Set(names)];
}

function cleanMap(map: FileOrderMap): FileOrderMap {
  const out: FileOrderMap = {};
  for (const [parentRaw, namesRaw] of Object.entries(map)) {
    let parent: string;
    try { parent = normalizeParentPath(parentRaw); } catch { continue; }
    const names = uniqueNames(namesRaw.map((name) => {
      try { return normalizeChildName(name); } catch { return null; }
    }).filter((name): name is string => name != null));
    if (names.length) out[parent] = names;
  }
  return out;
}
