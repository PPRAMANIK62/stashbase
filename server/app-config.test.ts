import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runConfigWrite(home: string) {
  return spawnSync(
    process.execPath,
    [
      '--no-warnings',
      '--import',
      'tsx',
      '--input-type=module',
      '--eval',
      `
        try {
          const { writeAppConfigStrict } = await import('./server/app-config.ts');
          writeAppConfigStrict({ embedder: { provider: 'openai', apiKey: 'test-key' } });
        } catch (error) {
          process.stderr.write(JSON.stringify({
            message: error instanceof Error ? error.message : String(error),
            code: error?.code,
            status: error?.status,
          }));
          process.exitCode = 17;
        }
      `,
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, HOME: home, USERPROFILE: home },
    },
  );
}

function runConfigMutation(home: string, statement: string) {
  return spawnSync(
    process.execPath,
    [
      '--no-warnings',
      '--import',
      'tsx',
      '--input-type=module',
      '--eval',
      `
        try {
          const config = await import('./server/app-config.ts');
          ${statement}
        } catch (error) {
          process.stderr.write(error instanceof Error ? error.message : String(error));
          process.exitCode = 17;
        }
      `,
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, HOME: home, USERPROFILE: home },
    },
  );
}

test('credential and source mutations never overwrite malformed config through a fallback read', () => {
  const statements = [
    `config.setHostedAccountSession({ accessToken: 'access', refreshToken: 'refresh', expiresAt: 4102444800, userId: 'user', email: 'person@example.com' });`,
    `config.setEmbedderConfig({ provider: 'openai', apiKey: 'sk-test' });`,
    `config.setEmbeddingSource('openai');`,
  ];
  for (const statement of statements) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-config-corrupt-test-'));
    const configDir = path.join(home, '.stashbase');
    const configPath = path.join(configDir, 'config.json');
    fs.mkdirSync(configDir);
    fs.writeFileSync(configPath, '{ malformed but user-owned config');
    try {
      const result = runConfigMutation(home, statement);
      assert.equal(result.status, 17);
      assert.match(result.stderr, /Could not read .*config\.json: invalid JSON/);
      assert.equal(fs.readFileSync(configPath, 'utf8'), '{ malformed but user-owned config');
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
});

test('library membership mutations never overwrite malformed config through a fallback read', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-folder-config-corrupt-test-'));
  const configDir = path.join(home, '.stashbase');
  const configPath = path.join(configDir, 'config.json');
  const member = path.join(home, 'member');
  fs.mkdirSync(configDir);
  fs.mkdirSync(member);
  fs.writeFileSync(configPath, '{ malformed but user-owned config');
  try {
    const result = runConfigMutation(home, `
      const folder = await import('./server/folder.ts');
      folder.setCurrentFolder(${JSON.stringify(member)});
    `);
    assert.equal(result.status, 17);
    assert.match(result.stderr, /Could not read .*config\.json: invalid JSON/);
    assert.equal(fs.readFileSync(configPath, 'utf8'), '{ malformed but user-owned config');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('an in-progress library removal blocks reopen and descendant registration', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-folder-removal-gate-'));
  const member = path.join(home, 'member');
  fs.mkdirSync(member);
  try {
    const result = runConfigMutation(home, `
      const assert = (await import('node:assert/strict')).default;
      const path = await import('node:path');
      const folder = await import('./server/folder.ts');
      folder.registerLibraryFolder(${JSON.stringify(member)});
      const finish = folder.beginLibraryFolderRemoval(${JSON.stringify(member)});
      try {
        assert.throws(() => folder.setCurrentFolder(${JSON.stringify(member)}), (error) => error.code === 'FOLDER_REMOVING');
        assert.throws(() => folder.registerLibraryFolder(path.join(${JSON.stringify(member)}, 'child')), (error) => error.code === 'FOLDER_REMOVING');
      } finally {
        finish();
      }
      folder.setCurrentFolder(${JSON.stringify(member)});
    `);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('macOS config writes do not alter an ACL that blocks atomic temp files', {
  skip: process.platform !== 'darwin',
}, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-config-acl-test-'));
  const configDir = path.join(home, '.stashbase');
  const deniedProbe = path.join(configDir, 'denied-probe');
  fs.mkdirSync(configDir);

  try {
    execFileSync('/bin/chmod', ['+a', `${os.userInfo().username} deny add_file,delete_child`, configDir]);
    assert.throws(
      () => fs.writeFileSync(deniedProbe, 'blocked'),
      (error: NodeJS.ErrnoException) => error.code === 'EACCES' || error.code === 'EPERM',
      'test ACL did not block file creation',
    );

    const result = runConfigWrite(home);
    assert.equal(result.status, 17);
    const failure = JSON.parse(result.stderr);
    assert.equal(failure.code, 'CONFIG_NOT_WRITABLE');
    assert.equal(failure.status, 500);
    assert.match(failure.message, /cannot save settings/i);
    assert.match(failure.message, /~\/\.stashbase/);
    assert.doesNotMatch(failure.message, /config\.json\..*\.tmp/);
    assert.throws(
      () => fs.writeFileSync(deniedProbe, 'still blocked'),
      (error: NodeJS.ErrnoException) => error.code === 'EACCES' || error.code === 'EPERM',
      'StashBase must leave the user-managed ACL unchanged',
    );
  } finally {
    execFileSync('/bin/chmod', ['-RN', configDir]);
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('macOS config writes replace raw EPERM temp-file errors with an actionable diagnostic', {
  skip: process.platform !== 'darwin',
}, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-config-flags-test-'));
  const configDir = path.join(home, '.stashbase');
  fs.mkdirSync(configDir);

  try {
    execFileSync('/usr/bin/chflags', ['uchg', configDir]);
    const result = runConfigWrite(home);
    assert.equal(result.status, 17);
    const failure = JSON.parse(result.stderr);
    assert.equal(failure.code, 'CONFIG_NOT_WRITABLE');
    assert.equal(failure.status, 500);
    assert.match(failure.message, /cannot save settings/i);
    assert.match(failure.message, /~\/\.stashbase/);
    assert.doesNotMatch(failure.message, /config\.json\..*\.tmp/);
  } finally {
    execFileSync('/usr/bin/chflags', ['nouchg', configDir]);
    fs.rmSync(home, { recursive: true, force: true });
  }
});
