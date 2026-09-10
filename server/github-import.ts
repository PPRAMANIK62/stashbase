/** Public GitHub acquisition with isolated Git execution and staged publication. */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { getFolderHome } from './folder.ts';
import { terminateExtractorTree } from './extractor-process.ts';
import { logger } from './log.ts';
import { validateFolderName } from '../shared/folder-name.ts';
import {
  parseGitHubRepositoryUrl,
  type ParsedGitHubRepositoryUrl,
} from '../shared/github-import.ts';

const log = logger('github-import');
const GIT_OUTPUT_LIMIT_BYTES = 64 * 1024;

export type GitHubImportErrorCode =
  | 'INVALID_GITHUB_URL'
  | 'INVALID_FOLDER_NAME'
  | 'DESTINATION_EXISTS'
  | 'GIT_NOT_AVAILABLE'
  | 'PRIVATE_OR_NOT_FOUND'
  | 'UNSUPPORTED_LFS'
  | 'UNSUPPORTED_SUBMODULES'
  | 'CLONE_FAILED'
  | 'IMPORT_CANCELLED';

export class GitHubImportError extends Error {
  readonly status: number;
  readonly code: GitHubImportErrorCode;

  constructor(message: string, code: GitHubImportErrorCode, status = 400) {
    super(message);
    this.name = 'GitHubImportError';
    this.code = code;
    this.status = status;
  }
}

export type ValidatedGitHubUrl = ParsedGitHubRepositoryUrl;

export function parseAndValidateGitHubUrl(
  rawUrl: unknown,
): { ok: true; parsed: ValidatedGitHubUrl } | { ok: false; error: GitHubImportError } {
  const result = parseGitHubRepositoryUrl(rawUrl);
  return result.ok
    ? result
    : {
        ok: false,
        error: new GitHubImportError(result.message, 'INVALID_GITHUB_URL', 400),
      };
}

export function detectGitLfs(gitattributesContent: string): boolean {
  for (const line of gitattributesContent.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) continue;
    if (
      /\bfilter=lfs\b/i.test(clean)
      || /\bmerge=lfs\b/i.test(clean)
      || /\bdiff=lfs\b/i.test(clean)
    ) {
      return true;
    }
  }
  return false;
}

interface GitRunResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

interface GitRunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}

export interface GitHubImportDeps {
  folderHome(): string;
  isGitAvailable(): Promise<boolean>;
  runGit(args: string[], options: GitRunOptions): Promise<GitRunResult>;
  publish(stagedRepository: string, target: string, signal: AbortSignal): Promise<void>;
}

async function defaultIsGitAvailable(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    try {
      const proc = spawn('git', ['--version'], {
        stdio: 'ignore',
        shell: false,
        windowsHide: true,
      });
      proc.once('error', () => resolve(false));
      proc.once('close', (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}

function appendBounded(current: string, chunk: Buffer | string): string {
  if (Buffer.byteLength(current) >= GIT_OUTPUT_LIMIT_BYTES) return current;
  const remaining = GIT_OUTPUT_LIMIT_BYTES - Buffer.byteLength(current);
  return current + Buffer.from(chunk).subarray(0, remaining).toString();
}

async function defaultRunGit(args: string[], options: GitRunOptions): Promise<GitRunResult> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(abortError());
      return;
    }

    let proc: ReturnType<typeof spawn>;
    try {
      const env = { ...process.env };
      for (const key of Object.keys(env)) {
        if (key.startsWith('GIT_')) delete env[key];
      }
      proc = spawn('git', args, {
        cwd: options.cwd,
        env: {
          ...env,
          ...options.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_ASKPASS: '',
        },
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
      });
    } catch (err: unknown) {
      reject(err);
      return;
    }

    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (chunk: Buffer | string) => {
      stdout = appendBounded(stdout, chunk);
    });
    proc.stderr?.on('data', (chunk: Buffer | string) => {
      stderr = appendBounded(stderr, chunk);
    });

    const onAbort = () => terminateExtractorTree(proc);
    options.signal?.addEventListener('abort', onAbort, { once: true });

    const retireAbortListener = () => {
      options.signal?.removeEventListener('abort', onAbort);
    };
    proc.once('error', (err) => {
      retireAbortListener();
      reject(err);
    });
    proc.once('close', (code) => {
      retireAbortListener();
      resolve({ exitCode: code ?? 1, stderr, stdout });
    });
  });
}

/**
 * Reserve the final directory without clobbering a concurrent destination,
 * then move the already-validated repository into that owned reservation.
 */
export async function publishStagedRepository(
  stagedRepository: string,
  target: string,
  signal: AbortSignal,
): Promise<void> {
  throwIfCancelled(signal);
  await fs.promises.mkdir(target, { recursive: false });
  try {
    const entries = await fs.promises.readdir(stagedRepository);
    for (const entry of entries) {
      throwIfCancelled(signal);
      await fs.promises.rename(path.join(stagedRepository, entry), path.join(target, entry));
    }
  } catch (err: unknown) {
    try {
      await fs.promises.rm(target, { recursive: true, force: true });
    } catch {
      // The original failure remains authoritative; startup never assumes an
      // ambiguously retained final directory is safe to remove.
    }
    throw err;
  }
}

export const productionGitHubImportDeps: GitHubImportDeps = {
  folderHome: getFolderHome,
  isGitAvailable: defaultIsGitAvailable,
  runGit: defaultRunGit,
  publish: publishStagedRepository,
};

export interface ImportPublicGitHubRepositoryInput {
  url: unknown;
  folderName?: unknown;
  signal?: AbortSignal;
}

export interface ImportPublicGitHubRepositoryResult {
  path: string;
}

interface ActiveImport {
  controller: AbortController;
  completion: Promise<void>;
  complete(): void;
}

const activeImports = new Set<ActiveImport>();

function createActiveImport(externalSignal?: AbortSignal): {
  active: ActiveImport;
  removeExternalListener(): void;
} {
  const controller = new AbortController();
  let complete!: () => void;
  const completion = new Promise<void>((resolve) => { complete = resolve; });
  const active = { controller, completion, complete };
  const relayAbort = () => controller.abort(externalSignal?.reason ?? abortError());
  if (externalSignal?.aborted) relayAbort();
  else externalSignal?.addEventListener('abort', relayAbort, { once: true });
  return {
    active,
    removeExternalListener: () => externalSignal?.removeEventListener('abort', relayAbort),
  };
}

/** Abort active Git work and wait for its staging cleanup during app shutdown. */
export async function cancelAllGitHubImports(): Promise<number> {
  const active = [...activeImports];
  for (const operation of active) operation.controller.abort(abortError());
  await Promise.allSettled(active.map((operation) => operation.completion));
  return active.length;
}

export async function importPublicGitHubRepository(
  input: ImportPublicGitHubRepositoryInput,
  deps: GitHubImportDeps = productionGitHubImportDeps,
): Promise<ImportPublicGitHubRepositoryResult> {
  const urlValidation = parseAndValidateGitHubUrl(input.url);
  if (!urlValidation.ok) throw urlValidation.error;

  const { active, removeExternalListener } = createActiveImport(input.signal);
  activeImports.add(active);
  try {
    return await runImport(input, urlValidation.parsed, active.controller.signal, deps);
  } finally {
    removeExternalListener();
    activeImports.delete(active);
    active.complete();
  }
}

async function runImport(
  input: ImportPublicGitHubRepositoryInput,
  validatedUrl: ValidatedGitHubUrl,
  signal: AbortSignal,
  deps: GitHubImportDeps,
): Promise<ImportPublicGitHubRepositoryResult> {
  const rawFolderName = input.folderName === undefined
    ? validatedUrl.defaultFolderName
    : typeof input.folderName === 'string'
      ? input.folderName.trim()
      : '';
  const invalidFolderName = validateFolderName(rawFolderName);
  if (invalidFolderName) {
    throw new GitHubImportError(invalidFolderName, 'INVALID_FOLDER_NAME', 400);
  }

  throwIfCancelled(signal);
  const folderHome = deps.folderHome();
  const target = path.join(folderHome, rawFolderName);
  if (await pathExists(target)) throw destinationExists(rawFolderName);

  if (!(await deps.isGitAvailable())) {
    throw new GitHubImportError(
      'Git is not available. Install Git or clone externally and use Open Folder….',
      'GIT_NOT_AVAILABLE',
      503,
    );
  }
  throwIfCancelled(signal);

  const operationRoot = path.join(folderHome, `.import-staging-${randomUUID()}`);
  const stagedRepository = path.join(operationRoot, 'repository');
  const emptyGitConfig = path.join(operationRoot, 'gitconfig');
  const emptyTemplate = path.join(operationRoot, 'template');
  const emptyHooks = path.join(operationRoot, 'hooks');

  try {
    await fs.promises.mkdir(operationRoot, { recursive: false });
    await Promise.all([
      fs.promises.writeFile(emptyGitConfig, '', { encoding: 'utf8', flag: 'wx' }),
      fs.promises.mkdir(emptyTemplate),
      fs.promises.mkdir(emptyHooks),
    ]);

    let cloneResult: GitRunResult;
    try {
      cloneResult = await deps.runGit([
        '-c',
        `core.hooksPath=${emptyHooks}`,
        'clone',
        '--depth',
        '1',
        '--single-branch',
        '--no-tags',
        '--no-recurse-submodules',
        `--template=${emptyTemplate}`,
        validatedUrl.canonicalUrl,
        stagedRepository,
      ], {
        signal,
        env: {
          GIT_CONFIG_GLOBAL: emptyGitConfig,
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_LFS_SKIP_SMUDGE: '1',
          GCM_INTERACTIVE: 'Never',
        },
      });
    } catch (err: unknown) {
      if (signal.aborted || isAbortError(err)) throw cancelled();
      throw new GitHubImportError('Failed to clone repository.', 'CLONE_FAILED', 500);
    }

    if (cloneResult.exitCode !== 0) {
      if (signal.aborted) throw cancelled();
      if (looksPrivateOrMissing(cloneResult.stderr)) {
        throw new GitHubImportError(
          'Repository not found or private. Make sure the repository exists and is public.',
          'PRIVATE_OR_NOT_FOUND',
          404,
        );
      }
      log.warn(`git clone failed with exit code ${cloneResult.exitCode}`);
      throw new GitHubImportError('Failed to clone repository.', 'CLONE_FAILED', 500);
    }

    throwIfCancelled(signal);
    if (await pathExists(path.join(stagedRepository, '.gitmodules'))) {
      throw new GitHubImportError(
        'Repositories with submodules are not supported.',
        'UNSUPPORTED_SUBMODULES',
        400,
      );
    }
    if (await repositoryDeclaresGitLfs(stagedRepository, signal)) {
      throw new GitHubImportError(
        'Repositories with Git LFS are not supported.',
        'UNSUPPORTED_LFS',
        400,
      );
    }

    throwIfCancelled(signal);
    if (await pathExists(target)) throw destinationExists(rawFolderName);
    try {
      await deps.publish(stagedRepository, target, signal);
    } catch (err: unknown) {
      if (signal.aborted || isAbortError(err)) throw cancelled();
      if (isDestinationCollision(err)) throw destinationExists(rawFolderName);
      throw err;
    }

    return { path: target };
  } catch (err: unknown) {
    if (err instanceof GitHubImportError) throw err;
    if (signal.aborted || isAbortError(err)) throw cancelled();
    const code = (err as NodeJS.ErrnoException)?.code;
    log.warn(`GitHub import failed during local staging${code ? ` (${code})` : ''}`);
    throw new GitHubImportError('Failed to import repository.', 'CLONE_FAILED', 500);
  } finally {
    try {
      await fs.promises.rm(operationRoot, { recursive: true, force: true });
    } catch {
      log.warn('GitHub import staging cleanup failed');
    }
  }
}

async function repositoryDeclaresGitLfs(root: string, signal: AbortSignal): Promise<boolean> {
  const pending = [root];
  while (pending.length > 0) {
    throwIfCancelled(signal);
    const current = pending.pop()!;
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git') continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(absolute);
      else if (entry.isFile() && entry.name === '.gitattributes') {
        if (await fileDeclaresGitLfs(absolute, signal)) return true;
      }
    }
  }
  return false;
}

async function fileDeclaresGitLfs(file: string, signal: AbortSignal): Promise<boolean> {
  const stream = fs.createReadStream(file, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      throwIfCancelled(signal);
      if (detectGitLfs(String(line))) return true;
    }
    return false;
  } finally {
    lines.close();
    stream.destroy();
  }
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await fs.promises.lstat(candidate);
    return true;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return false;
    throw err;
  }
}

function looksPrivateOrMissing(stderr: string): boolean {
  const normalized = stderr.toLowerCase();
  return normalized.includes('repository not found')
    || normalized.includes('authentication failed')
    || normalized.includes('could not read username')
    || normalized.includes('terminal prompts disabled')
    || normalized.includes('remote: repository not found')
    || normalized.includes('404')
    || normalized.includes('403');
}

function isDestinationCollision(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException)?.code;
  return code === 'EEXIST' || code === 'ENOTEMPTY';
}

function destinationExists(folderName: string): GitHubImportError {
  return new GitHubImportError(
    `A folder named "${folderName}" already exists in your folder home.`,
    'DESTINATION_EXISTS',
    409,
  );
}

function abortError(): Error {
  const err = new Error('GitHub import cancelled');
  err.name = 'AbortError';
  return err;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

function cancelled(): GitHubImportError {
  return new GitHubImportError('Import was cancelled.', 'IMPORT_CANCELLED', 499);
}

function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) throw cancelled();
}
