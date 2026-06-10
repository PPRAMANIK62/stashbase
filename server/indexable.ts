import fs from 'node:fs';
import path from 'node:path';
import { detectFormat } from './format.ts';

/** Directories that are usually generated, dependency caches, VCS state,
 *  or source-project internals. If a user accidentally points the KB root
 *  at a code checkout, these skips keep indexing bounded and predictable. */
export const INDEX_EXCLUDED_DIRS = new Set<string>([
  '.cache',
  '.git',
  '.hg',
  '.next',
  '.nuxt',
  '.output',
  '.parcel-cache',
  '.pnpm-store',
  '.svelte-kit',
  '.turbo',
  '.venv',
  '.vite',
  '.yarn',
  '__pycache__',
  'bower_components',
  'build',
  'coverage',
  'DerivedData',
  'dist',
  'node_modules',
  'out',
  'target',
  'vendor',
]);

/** Hard ceiling for a single source text that we will send to the daemon.
 *  Large books/PDF extracts should be split into separate notes; huge
 *  bundled HTML/Markdown usually indicates saved app output or source
 *  trees and can trip provider request limits. */
export const MAX_INDEXABLE_BYTES = 600 * 1024;

export function isIndexExcludedDirName(name: string): boolean {
  return INDEX_EXCLUDED_DIRS.has(name);
}

export function dipsIntoIndexExcludedDir(relPath: string): boolean {
  return relPath
    .replace(/\\/g, '/')
    .split('/')
    .some((seg) => INDEX_EXCLUDED_DIRS.has(seg));
}

export function shouldIndexFilePath(relPath: string): boolean {
  if (!detectFormat(relPath)) return false;
  return !dipsIntoIndexExcludedDir(relPath);
}

export function shouldIndexKbRel(kbRelPath: string): boolean {
  const norm = kbRelPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const slash = norm.indexOf('/');
  if (slash < 0) return false;
  return shouldIndexFilePath(norm.slice(slash + 1));
}

export function indexableFileSizeError(absPath: string): string | null {
  let st: fs.Stats;
  try { st = fs.statSync(absPath); } catch { return 'file is not readable'; }
  if (!st.isFile()) return 'path is not a file';
  if (st.size === 0) return 'empty file';
  if (st.size > MAX_INDEXABLE_BYTES) {
    return `file is too large to index (${formatBytes(st.size)} > ${formatBytes(MAX_INDEXABLE_BYTES)})`;
  }
  return null;
}

export function contentSizeError(content: string): string | null {
  const bytes = Buffer.byteLength(content, 'utf8');
  if (bytes === 0) return null;
  if (bytes > MAX_INDEXABLE_BYTES) {
    return `file is too large to index (${formatBytes(bytes)} > ${formatBytes(MAX_INDEXABLE_BYTES)})`;
  }
  return null;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}
