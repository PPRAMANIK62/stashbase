/**
 * Cross-platform filesystem path semantics.
 *
 * This module is the single seam between user/config/daemon path strings and
 * platform filesystem rules. Callers keep the source spelling returned by
 * `absolute()` for persistence and display, use `identity()` only for keyed
 * state, and use `resolveUnder()` for filesystem access scoped to a folder.
 */
import fs from 'node:fs';
import path from 'node:path';

export type FilesystemPlatform = 'win32' | 'posix';
export type PathAccess = 'lexical' | 'existing' | 'creatable';

export interface ResolveUnderOptions {
  access?: PathAccess;
  label?: string;
}

export interface FilesystemPathModule {
  readonly platform: FilesystemPlatform;
  /** Absolute source spelling with POSIX separators. */
  absolute(input: string, base?: string): string;
  /** Stable comparison/map identity. Case-folded only on Windows. */
  identity(input: string): string;
  equal(a: string, b: string): boolean;
  contains(root: string, candidate: string): boolean;
  relative(root: string, candidate: string): string | null;
  join(root: string, relative: string): string;
  /** Restore the real component spelling where a Windows path exists. */
  canonicalRelative(root: string, relative: string): string;
  /** Resolve a folder-relative path and optionally enforce realpath safety. */
  resolveUnder(root: string, relative: string, options?: ResolveUnderOptions): string;
}

interface CreateFilesystemPathOptions {
  platform?: FilesystemPlatform;
  cwd?: string;
}

export function createFilesystemPath(
  options: CreateFilesystemPathOptions = {},
): FilesystemPathModule {
  const platform = options.platform ?? (process.platform === 'win32' ? 'win32' : 'posix');
  const pathApi = platform === 'win32' ? path.win32 : path.posix;
  const defaultCwd = options.cwd ?? defaultCwdFor(platform);

  function absolute(input: string, base = defaultCwd): string {
    requirePath(input);
    const prepared = prepareInput(input, platform);
    const preparedBase = prepareInput(base, platform);
    const resolved = pathApi.resolve(preparedBase, prepared);
    return toSourceSeparators(resolved, platform);
  }

  function identity(input: string): string {
    const source = absolute(input);
    return platform === 'win32' ? source.toLowerCase() : source;
  }

  function equal(a: string, b: string): boolean {
    return identity(a) === identity(b);
  }

  function contains(root: string, candidate: string): boolean {
    const rootKey = identity(root);
    const candidateKey = identity(candidate);
    return candidateKey === rootKey || candidateKey.startsWith(childPrefix(rootKey));
  }

  function relative(root: string, candidate: string): string | null {
    const rootSource = absolute(root);
    const candidateSource = absolute(candidate);
    if (!contains(rootSource, candidateSource)) return null;
    const rel = pathApi.relative(toNative(rootSource, platform), toNative(candidateSource, platform));
    if (escapesRoot(rel, pathApi)) return null;
    return rel.split(pathApi.sep).join('/');
  }

  function join(root: string, relativePath: string): string {
    const rootSource = absolute(root);
    const rel = normalizeRelative(relativePath, platform);
    if (!rel) return rootSource;
    const joined = absolute(toNative(rel, platform), toNative(rootSource, platform));
    if (!contains(rootSource, joined)) throw new Error('path escapes folder');
    return joined;
  }

  function canonicalRelative(root: string, relativePath: string): string {
    const rel = normalizeRelative(relativePath, platform);
    if (platform !== 'win32' || !rel) return rel;
    const canonical: string[] = [];
    let cursor = toNative(absolute(root), platform);
    for (const segment of rel.split('/')) {
      let spelling = segment;
      try {
        const found = fs.readdirSync(cursor).find(
          (entry) => entry.toLowerCase() === segment.toLowerCase(),
        );
        if (found) spelling = found;
      } catch {
        // A create target may have a missing suffix. Preserve caller spelling.
      }
      canonical.push(spelling);
      cursor = pathApi.join(cursor, spelling);
    }
    return canonical.join('/');
  }

  function resolveUnder(
    root: string,
    relativePath: string,
    options: ResolveUnderOptions = {},
  ): string {
    const access = options.access ?? 'lexical';
    const label = options.label ?? 'path';
    const rootSource = absolute(root);
    const targetSource = join(rootSource, relativePath);
    const rootNative = toNative(rootSource, platform);
    const targetNative = toNative(targetSource, platform);
    if (access === 'lexical') return targetSource;

    const rootReal = fs.realpathSync.native(rootNative);
    if (access === 'existing') {
      const targetReal = fs.realpathSync.native(targetNative);
      if (!contains(rootReal, targetReal)) {
        throw new Error(`${label} escapes folder through symlink`);
      }
      return targetSource;
    }

    let probe = pathApi.dirname(targetNative);
    while (!fs.existsSync(probe)) {
      const parent = pathApi.dirname(probe);
      if (parent === probe) break;
      probe = parent;
    }
    if (!contains(rootNative, probe)) throw new Error(`${label} escapes folder`);
    const probeReal = fs.realpathSync.native(probe);
    if (!contains(rootReal, probeReal)) {
      throw new Error(`${label} escapes folder through symlink`);
    }
    return targetSource;
  }

  return {
    platform,
    absolute,
    identity,
    equal,
    contains,
    relative,
    join,
    canonicalRelative,
    resolveUnder,
  };
}

export const filesystemPath = createFilesystemPath();

function requirePath(input: string): void {
  if (typeof input !== 'string' || input.length === 0) throw new Error('path required');
}

function defaultCwdFor(platform: FilesystemPlatform): string {
  if (platform === 'posix') return process.cwd();
  return path.win32.isAbsolute(process.cwd()) ? process.cwd() : 'C:\\';
}

function prepareInput(input: string, platform: FilesystemPlatform): string {
  if (platform === 'posix') return input;
  const native = input.replace(/\//g, '\\');
  if (/^\\\\\.\\/.test(native)) throw new Error('Windows device paths are not supported');
  if (/^[A-Za-z]:($|[^\\])/.test(native)) {
    throw new Error('drive-relative Windows paths are not supported');
  }
  if (/^\\\\\?\\UNC\\/i.test(native)) return `\\\\${native.slice(8)}`;
  if (/^\\\\\?\\[A-Za-z]:\\/.test(native)) return native.slice(4);
  return native;
}

function toSourceSeparators(input: string, platform: FilesystemPlatform): string {
  return platform === 'win32' ? input.replace(/\\/g, '/') : input;
}

function toNative(input: string, platform: FilesystemPlatform): string {
  return platform === 'win32' ? input.replace(/\//g, '\\') : input;
}

function childPrefix(root: string): string {
  return root.endsWith('/') ? root : `${root}/`;
}

function normalizeRelative(input: string, platform: FilesystemPlatform): string {
  if (typeof input !== 'string') throw new Error('path required');
  const source = input.replace(/\\/g, '/');
  if (source.startsWith('/') || (platform === 'win32' && /^[A-Za-z]:/.test(source))) {
    throw new Error('path must be relative to the folder');
  }
  const segments = source.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('invalid path segment');
  }
  return segments.join('/');
}

function escapesRoot(relative: string, pathApi: typeof path.posix | typeof path.win32): boolean {
  return relative === '..'
    || relative.startsWith(`..${pathApi.sep}`)
    || pathApi.isAbsolute(relative);
}
