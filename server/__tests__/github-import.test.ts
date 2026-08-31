/**
 * Contract tests for GitHub repository import: URL parsing & normalization,
 * folder name validation, Git availability check, shallow single-branch cloning,
 * rejection of submodules and Git LFS, atomic publication, cancellation,
 * and pristine working tree (no instruction seeding on folder entry).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-github-import-'));
process.env.STASHBASE_LOCAL_DATA_ROOT = path.join(scratch, 'app-data');

const {
  detectGitLfs,
  GitHubImportError,
  importPublicGitHubRepository,
  parseAndValidateGitHubUrl,
} = await import('../github-import.ts');
type GitHubImportDeps = import('../github-import.ts').GitHubImportDeps;
const { filesystemPath } = await import('../filesystem-path.ts');

const HOME = path.join(scratch, 'folder-home');
const MEMBER = path.join(scratch, 'members', 'ExistingRepo');
fs.mkdirSync(HOME, { recursive: true });
fs.mkdirSync(MEMBER, { recursive: true });

interface FakeGitDepsLog {
  gitCalls: Array<{ args: string[]; options: any }>;
  registered: string[];
  treeChanges: number;
  synced: string[];
}

function fakeDeps(options: {
  folderHome?: string;
  gitAvailable?: boolean;
  memberRoots?: string[];
  onClone?: (stagingDir: string) => void;
  cloneExitCode?: number;
  cloneStderr?: string;
  cloneError?: Error;
}): { deps: GitHubImportDeps; log: FakeGitDepsLog; home: string } {
  const home = options.folderHome ?? fs.mkdtempSync(path.join(scratch, 'home-'));
  const log: FakeGitDepsLog = {
    gitCalls: [],
    registered: [],
    treeChanges: 0,
    synced: [],
  };

  const deps: GitHubImportDeps = {
    folderHome: () => home,
    memberRoots: async () => options.memberRoots ?? [MEMBER],
    register: async (abs) => { log.registered.push(abs); },
    noteTreeChanged: () => { log.treeChanges += 1; },
    syncFolder: async (abs) => { log.synced.push(abs); },
    isGitAvailable: async () => options.gitAvailable ?? true,
    runGit: async (args, gitOptions) => {
      log.gitCalls.push({ args, options: gitOptions });
      if (options.cloneError) throw options.cloneError;
      if (gitOptions.signal?.aborted) {
        const err = new Error('aborted');
        (err as any).name = 'AbortError';
        throw err;
      }
      // Staging path is the last argument of git clone
      const stagingPath = args[args.length - 1];
      if (options.cloneExitCode !== undefined && options.cloneExitCode !== 0) {
        return {
          exitCode: options.cloneExitCode,
          stderr: options.cloneStderr ?? 'fatal: clone failed',
          stdout: '',
        };
      }
      // Default successful clone creates dummy files in staging
      fs.mkdirSync(stagingPath, { recursive: true });
      fs.writeFileSync(path.join(stagingPath, 'README.md'), '# Test Repo\n', 'utf8');
      if (options.onClone) {
        options.onClone(stagingPath);
      }
      return { exitCode: 0, stderr: '', stdout: '' };
    },
  };

  return { deps, log, home };
}

test('parseAndValidateGitHubUrl accepts canonical public GitHub URLs', () => {
  const valid = [
    'https://github.com/owner/repo',
    'https://github.com/owner/repo.git',
    'https://github.com/owner/repo/',
    'https://github.com/owner/repo.git/',
    '  https://github.com/Priyansh19077/CP-Templates  ',
  ];

  for (const url of valid) {
    const res = parseAndValidateGitHubUrl(url);
    assert.equal(res.ok, true, `URL ${url} must be accepted`);
    if (res.ok) {
      assert.match(res.parsed.canonicalUrl, /^https:\/\/github\.com\/[^/]+\/[^/]+$/);
      assert.equal(res.parsed.canonicalUrl.endsWith('.git'), false);
      assert.ok(res.parsed.defaultFolderName);
    }
  }
});

test('parseAndValidateGitHubUrl rejects non-GitHub, insecure, query-bearing, and invalid URLs', () => {
  const invalid = [
    '',
    '   ',
    'http://github.com/owner/repo',
    'https://gitlab.com/owner/repo',
    'https://notgithub.com/owner/repo',
    'https://user:pass@github.com/owner/repo',
    'https://github.com:8080/owner/repo',
    'https://github.com/owner/repo?ref=main',
    'https://github.com/owner/repo#readme',
    'https://github.com/owner/repo/tree/main',
    'https://github.com/owner/repo/blob/main/README.md',
    'https://github.com/owner',
    'https://github.com/',
    'git@github.com:owner/repo.git',
    'ssh://git@github.com/owner/repo.git',
    null,
    undefined,
    123,
  ];

  for (const bad of invalid) {
    const res = parseAndValidateGitHubUrl(bad);
    assert.equal(res.ok, false, `URL ${JSON.stringify(bad)} must be rejected`);
    if (!res.ok) {
      assert.equal(res.error.code, 'INVALID_GITHUB_URL');
      assert.equal(res.error.status, 400);
    }
  }
});

test('detectGitLfs identifies Git LFS declarations in .gitattributes', () => {
  assert.equal(detectGitLfs('*.psd filter=lfs diff=lfs merge=lfs -text'), true);
  assert.equal(detectGitLfs('*.zip filter=lfs'), true);
  assert.equal(detectGitLfs('*.png merge=lfs'), true);
  assert.equal(detectGitLfs('# *.psd filter=lfs\n*.txt text'), false);
  assert.equal(detectGitLfs('*.md text eol=lf'), false);
  assert.equal(detectGitLfs(''), false);
});

test('importPublicGitHubRepository rejects invalid folder names before clone', async () => {
  const { deps, log } = fakeDeps({});
  for (const bad of ['', '   ', 'a/b', 'a\\b', '..', '.hidden', 'name.', 'na<me', 'x'.repeat(65)]) {
    await assert.rejects(
      () => importPublicGitHubRepository({ url: 'https://github.com/owner/repo', folderName: bad }, deps),
      (err: Error & { status?: number; code?: string }) => err.status === 400 && err.code === 'INVALID_FOLDER_NAME',
    );
  }
  assert.equal(log.gitCalls.length, 0, 'No git process should spawn for invalid folder names');
});

test('importPublicGitHubRepository rejects destination existing in folder home or library', async () => {
  const { deps, log, home } = fakeDeps({});
  const existingFolder = path.join(home, 'ExistingChild');
  fs.mkdirSync(existingFolder, { recursive: true });

  await assert.rejects(
    () => importPublicGitHubRepository({ url: 'https://github.com/owner/ExistingChild' }, deps),
    (err: Error & { status?: number; code?: string }) => err.status === 409 && err.code === 'DESTINATION_EXISTS',
  );

  assert.equal(log.gitCalls.length, 0, 'No git process should spawn when destination exists');
});

test('importPublicGitHubRepository rejects when Git is not available', async () => {
  const { deps, log } = fakeDeps({ gitAvailable: false });

  await assert.rejects(
    () => importPublicGitHubRepository({ url: 'https://github.com/owner/repo' }, deps),
    (err: Error & { status?: number; code?: string }) => err.status === 503 && err.code === 'GIT_NOT_AVAILABLE',
  );

  assert.equal(log.gitCalls.length, 0);
});

test('importPublicGitHubRepository classifies private or not-found errors', async () => {
  const { deps } = fakeDeps({
    cloneExitCode: 128,
    cloneStderr: 'fatal: could not read Username for \'https://github.com\': terminal prompts disabled',
  });

  await assert.rejects(
    () => importPublicGitHubRepository({ url: 'https://github.com/owner/private-repo' }, deps),
    (err: Error & { status?: number; code?: string }) => err.status === 404 && err.code === 'PRIVATE_OR_NOT_FOUND',
  );
});

test('importPublicGitHubRepository classifies general clone failures', async () => {
  const { deps } = fakeDeps({
    cloneExitCode: 1,
    cloneStderr: 'fatal: unable to access network: Connection timed out',
  });

  await assert.rejects(
    () => importPublicGitHubRepository({ url: 'https://github.com/owner/timeout-repo' }, deps),
    (err: Error & { status?: number; code?: string }) => err.status === 500 && err.code === 'CLONE_FAILED',
  );
});

test('importPublicGitHubRepository rejects repositories with submodules and cleans staging', async () => {
  let observedStagingDir = '';
  const { deps, home } = fakeDeps({
    onClone: (stagingPath) => {
      observedStagingDir = stagingPath;
      fs.writeFileSync(path.join(stagingPath, '.gitmodules'), '[submodule "dep"]\npath = dep\n', 'utf8');
    },
  });

  await assert.rejects(
    () => importPublicGitHubRepository({ url: 'https://github.com/owner/submod-repo' }, deps),
    (err: Error & { status?: number; code?: string }) => err.status === 400 && err.code === 'UNSUPPORTED_SUBMODULES',
  );

  assert.ok(observedStagingDir);
  assert.equal(fs.existsSync(observedStagingDir), false, 'Staging directory must be cleaned up');
  assert.equal(fs.existsSync(path.join(home, 'submod-repo')), false);
});

test('importPublicGitHubRepository rejects repositories with Git LFS and cleans staging', async () => {
  let observedStagingDir = '';
  const { deps, home } = fakeDeps({
    onClone: (stagingPath) => {
      observedStagingDir = stagingPath;
      fs.writeFileSync(path.join(stagingPath, '.gitattributes'), '*.bin filter=lfs diff=lfs merge=lfs -text\n', 'utf8');
    },
  });

  await assert.rejects(
    () => importPublicGitHubRepository({ url: 'https://github.com/owner/lfs-repo' }, deps),
    (err: Error & { status?: number; code?: string }) => err.status === 400 && err.code === 'UNSUPPORTED_LFS',
  );

  assert.ok(observedStagingDir);
  assert.equal(fs.existsSync(observedStagingDir), false, 'Staging directory must be cleaned up');
  assert.equal(fs.existsSync(path.join(home, 'lfs-repo')), false);
});

test('importPublicGitHubRepository supports cancellation and cleans staging', async () => {
  const ac = new AbortController();
  ac.abort();

  const { deps, home } = fakeDeps({});

  await assert.rejects(
    () => importPublicGitHubRepository({ url: 'https://github.com/owner/cancel-repo', signal: ac.signal }, deps),
    (err: Error & { status?: number; code?: string }) => err.status === 499 && err.code === 'IMPORT_CANCELLED',
  );

  assert.equal(fs.existsSync(path.join(home, 'cancel-repo')), false);
});

test('importPublicGitHubRepository successfully clones, validates, publishes, registers, and syncs', async () => {
  const { deps, log, home } = fakeDeps({});
  const result = await importPublicGitHubRepository({
    url: 'https://github.com/Priyansh19077/CP-Templates.git',
    folderName: 'CP-Templates-Imported',
  }, deps);

  const target = path.join(home, 'CP-Templates-Imported');
  assert.equal(result.path, target);
  assert.equal(fs.existsSync(target), true);
  assert.equal(fs.existsSync(path.join(target, 'README.md')), true);

  // Pristine working tree: NO instruction files (AGENTS.md, CLAUDE.md) seeded on import!
  assert.equal(fs.existsSync(path.join(target, 'AGENTS.md')), false);
  assert.equal(fs.existsSync(path.join(target, 'CLAUDE.md')), false);

  assert.equal(log.gitCalls.length, 1);
  assert.deepEqual(log.gitCalls[0].args.slice(0, 6), [
    'clone',
    '--depth',
    '1',
    '--single-branch',
    '--no-tags',
    'https://github.com/Priyansh19077/CP-Templates',
  ]);

  assert.deepEqual(log.registered, [target]);
  assert.equal(log.treeChanges, 1);

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(log.synced, [target]);
});
