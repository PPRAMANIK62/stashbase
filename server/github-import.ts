/**
 * GitHub repository import module.
 *
 * Implements the minimal "Import from GitHub..." flow. Clones a public GitHub
 * repository's default branch shallowly into an operation-owned staging directory,
 * validates the repository (rejecting submodules and Git LFS), safely publishes it
 * no-clobber to the fixed StashBase folder home, registers the folder into library
 * membership, triggers background sync, and returns its destination path.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  ensureFolderHome,
  getFolderHome,
  memberFolderRootsAsync,
  registerLibraryFolderAsync,
  validateFolderName,
} from './folder.ts';
import { filesystemPath } from './filesystem-path.ts';
import { noteTreeChanged } from './watcher.ts';
import { syncFolderNow } from './state.ts';
import { logger } from './log.ts';

const log = logger('github-import');

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

export interface ValidatedGitHubUrl {
  canonicalUrl: string;
  owner: string;
  repo: string;
  defaultFolderName: string;
}

export function parseAndValidateGitHubUrl(
  rawUrl: unknown,
): { ok: true; parsed: ValidatedGitHubUrl } | { ok: false; error: GitHubImportError } {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return {
      ok: false,
      error: new GitHubImportError(
        'GitHub repository URL is required.',
        'INVALID_GITHUB_URL',
        400,
      ),
    };
  }
  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      error: new GitHubImportError(
        'Invalid URL. Enter a complete https://github.com/<owner>/<repo> URL.',
        'INVALID_GITHUB_URL',
        400,
      ),
    };
  }
  if (parsed.protocol !== 'https:') {
    return {
      ok: false,
      error: new GitHubImportError(
        'Only HTTPS GitHub URLs are supported.',
        'INVALID_GITHUB_URL',
        400,
      ),
    };
  }
  if (parsed.hostname.toLowerCase() !== 'github.com') {
    return {
      ok: false,
      error: new GitHubImportError(
        'Only github.com URLs are supported.',
        'INVALID_GITHUB_URL',
        400,
      ),
    };
  }
  if (parsed.username || parsed.password) {
    return {
      ok: false,
      error: new GitHubImportError(
        'URLs with credentials are not supported.',
        'INVALID_GITHUB_URL',
        400,
      ),
    };
  }
  if (parsed.port && parsed.port !== '443') {
    return {
      ok: false,
      error: new GitHubImportError(
        'Custom ports are not supported.',
        'INVALID_GITHUB_URL',
        400,
      ),
    };
  }
  if (parsed.search) {
    return {
      ok: false,
      error: new GitHubImportError(
        'Query parameters are not supported.',
        'INVALID_GITHUB_URL',
        400,
      ),
    };
  }
  if (parsed.hash) {
    return {
      ok: false,
      error: new GitHubImportError(
        'URL fragments are not supported.',
        'INVALID_GITHUB_URL',
        400,
      ),
    };
  }
  const parts = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (parts.length !== 2) {
    return {
      ok: false,
      error: new GitHubImportError(
        'Enter a complete https://github.com/<owner>/<repo> URL.',
        'INVALID_GITHUB_URL',
        400,
      ),
    };
  }
  const [owner, rawRepo] = parts;
  if (!owner || !rawRepo) {
    return {
      ok: false,
      error: new GitHubImportError(
        'Enter a complete https://github.com/<owner>/<repo> URL.',
        'INVALID_GITHUB_URL',
        400,
      ),
    };
  }
  const repo = rawRepo.endsWith('.git') ? rawRepo.slice(0, -4) : rawRepo;
  if (!repo || repo === '.' || repo === '..') {
    return {
      ok: false,
      error: new GitHubImportError(
        'Enter a complete https://github.com/<owner>/<repo> URL.',
        'INVALID_GITHUB_URL',
        400,
      ),
    };
  }
  return {
    ok: true,
    parsed: {
      canonicalUrl: `https://github.com/${owner}/${repo}`,
      owner,
      repo,
      defaultFolderName: repo,
    },
  };
}

export function detectGitLfs(gitattributesContent: string): boolean {
  for (const line of gitattributesContent.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) continue;
    if (/\bfilter=lfs\b/i.test(clean) || /\bmerge=lfs\b/i.test(clean) || /\bdiff=lfs\b/i.test(clean)) {
      return true;
    }
  }
  return false;
}

export interface GitHubImportDeps {
  folderHome(): string;
  memberRoots(): Promise<string[]>;
  register(abs: string): Promise<void>;
  noteTreeChanged(): void;
  syncFolder(abs: string): Promise<unknown>;
  isGitAvailable(): Promise<boolean>;
  runGit(
    args: string[],
    options: { cwd?: string; env?: NodeJS.ProcessEnv; signal?: AbortSignal },
  ): Promise<{ exitCode: number; stderr: string; stdout: string }>;
}

async function defaultIsGitAvailable(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    try {
      const proc = spawn('git', ['--version'], { stdio: 'ignore', shell: false });
      proc.on('error', () => resolve(false));
      proc.on('close', (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}

async function defaultRunGit(
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; signal?: AbortSignal },
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      const err = new Error('git process cancelled');
      (err as any).name = 'AbortError';
      reject(err);
      return;
    }
    const proc = spawn('git', args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_ASKPASS: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    let onAbort: (() => void) | undefined;
    if (options.signal) {
      onAbort = () => {
        try {
          proc.kill('SIGTERM');
          setTimeout(() => {
            try { proc.kill('SIGKILL'); } catch { /* ignore */ }
          }, 2000).unref?.();
        } catch {
          /* ignore */
        }
      };
      options.signal.addEventListener('abort', onAbort, { once: true });
    }

    proc.on('error', (err) => {
      if (onAbort && options.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }
      reject(err);
    });

    proc.on('close', (code) => {
      if (onAbort && options.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }
      resolve({
        exitCode: code ?? 1,
        stderr,
        stdout,
      });
    });
  });
}

export const productionGitHubImportDeps: GitHubImportDeps = {
  folderHome: () => {
    ensureFolderHome();
    return getFolderHome();
  },
  memberRoots: memberFolderRootsAsync,
  register: registerLibraryFolderAsync,
  noteTreeChanged,
  syncFolder: (abs) => syncFolderNow(abs, { reason: 'github_import' }),
  isGitAvailable: defaultIsGitAvailable,
  runGit: defaultRunGit,
};

export interface ImportPublicGitHubRepositoryInput {
  url: unknown;
  folderName?: unknown;
  signal?: AbortSignal;
}

export interface ImportPublicGitHubRepositoryResult {
  path: string;
}

export async function importPublicGitHubRepository(
  input: ImportPublicGitHubRepositoryInput,
  deps: GitHubImportDeps = productionGitHubImportDeps,
): Promise<ImportPublicGitHubRepositoryResult> {
  const urlValidation = parseAndValidateGitHubUrl(input.url);
  if (!urlValidation.ok) throw urlValidation.error;
  const { canonicalUrl, defaultFolderName } = urlValidation.parsed;

  const rawFolderName = input.folderName !== undefined
    ? (typeof input.folderName === 'string' ? input.folderName.trim() : '')
    : defaultFolderName;

  const folderNameBad = validateFolderName(rawFolderName);
  if (folderNameBad) {
    throw new GitHubImportError(
      folderNameBad,
      'INVALID_FOLDER_NAME',
      400,
    );
  }

  const folderHome = deps.folderHome();
  const target = path.join(folderHome, rawFolderName);

  // Pre-check destination collision before starting potentially slow clone.
  if (fs.existsSync(target)) {
    throw new GitHubImportError(
      `A folder named "${rawFolderName}" already exists in your folder home.`,
      'DESTINATION_EXISTS',
      409,
    );
  }
  const memberRoots = await deps.memberRoots();
  if (memberRoots.some((root) => filesystemPath.equal(root, target))) {
    throw new GitHubImportError(
      `A folder named "${rawFolderName}" is already in your library.`,
      'DESTINATION_EXISTS',
      409,
    );
  }

  // Verify system Git availability without shell.
  const gitAvailable = await deps.isGitAvailable();
  if (!gitAvailable) {
    throw new GitHubImportError(
      'Git is not available. Install Git or clone externally and use Open Folder….',
      'GIT_NOT_AVAILABLE',
      503,
    );
  }

  // Clone into an operation-owned hidden staging directory under folderHome.
  const stagingDirName = `.import-staging-${randomUUID()}`;
  const stagingPath = path.join(folderHome, stagingDirName);

  try {
    if (input.signal?.aborted) {
      throw new GitHubImportError('Import was cancelled.', 'IMPORT_CANCELLED', 499);
    }

    let cloneResult: { exitCode: number; stderr: string; stdout: string };
    try {
      cloneResult = await deps.runGit(
        ['clone', '--depth', '1', '--single-branch', '--no-tags', canonicalUrl, stagingPath],
        { signal: input.signal },
      );
    } catch (err: unknown) {
      if (input.signal?.aborted || (err as any)?.name === 'AbortError') {
        throw new GitHubImportError('Import was cancelled.', 'IMPORT_CANCELLED', 499);
      }
      throw new GitHubImportError('Failed to clone repository.', 'CLONE_FAILED', 500);
    }

    if (cloneResult.exitCode !== 0) {
      if (input.signal?.aborted) {
        throw new GitHubImportError('Import was cancelled.', 'IMPORT_CANCELLED', 499);
      }
      const stderr = cloneResult.stderr.toLowerCase();
      if (
        stderr.includes('repository not found')
        || stderr.includes('authentication failed')
        || stderr.includes('could not read username')
        || stderr.includes('terminal prompts disabled')
        || stderr.includes('remote: repository not found')
        || stderr.includes('404')
        || stderr.includes('403')
      ) {
        throw new GitHubImportError(
          'Repository not found or private. Make sure the repository exists and is public.',
          'PRIVATE_OR_NOT_FOUND',
          404,
        );
      }
      log.warn(`git clone failed with exit code ${cloneResult.exitCode}: ${cloneResult.stderr.slice(0, 500)}`);
      throw new GitHubImportError('Failed to clone repository.', 'CLONE_FAILED', 500);
    }

    // Inspect repository before publication:
    // Reject repositories with submodules.
    if (fs.existsSync(path.join(stagingPath, '.gitmodules'))) {
      throw new GitHubImportError(
        'Repositories with submodules are not supported.',
        'UNSUPPORTED_SUBMODULES',
        400,
      );
    }

    // Reject repositories declaring Git LFS in .gitattributes.
    const gitattributesPath = path.join(stagingPath, '.gitattributes');
    if (fs.existsSync(gitattributesPath)) {
      try {
        const content = fs.readFileSync(gitattributesPath, 'utf8');
        if (detectGitLfs(content)) {
          throw new GitHubImportError(
            'Repositories with Git LFS are not supported.',
            'UNSUPPORTED_LFS',
            400,
          );
        }
      } catch (err) {
        if (err instanceof GitHubImportError) throw err;
        // Ignore read errors for malformed attributes; continue.
      }
    }

    // No-clobber publication: atomic rename into destination.
    if (fs.existsSync(target)) {
      throw new GitHubImportError(
        `A folder named "${rawFolderName}" already exists in your folder home.`,
        'DESTINATION_EXISTS',
        409,
      );
    }

    try {
      await fs.promises.rename(stagingPath, target);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === 'EEXIST' || code === 'ENOTEMPTY' || code === 'EPERM') {
        throw new GitHubImportError(
          `A folder named "${rawFolderName}" already exists in your folder home.`,
          'DESTINATION_EXISTS',
          409,
        );
      }
      throw err;
    }

    // Successfully published to target. Register membership.
    try {
      await deps.register(target);
    } catch (regErr) {
      log.warn(`registerLibraryFolder failed after publishing ${target}: ${String(regErr)}`);
      // Published folder is retained as per contract.
    }
    deps.noteTreeChanged();
    void Promise.resolve()
      .then(() => deps.syncFolder(target))
      .catch((syncErr: unknown) => {
        log.warn(`background sync failed for ${target}: ${String(syncErr)}`);
      });

    return { path: target };
  } finally {
    // Always clean up staging directory if it still exists.
    if (fs.existsSync(stagingPath)) {
      try {
        await fs.promises.rm(stagingPath, { recursive: true, force: true });
      } catch {
        /* best-effort cleanup of temporary staging */
      }
    }
  }
}
