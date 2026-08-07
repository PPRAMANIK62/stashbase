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
      env: { ...process.env, HOME: home },
    },
  );
}

test('macOS config writes repair a same-owner ACL that blocks atomic temp files', {
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
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(configDir, 'config.json'), 'utf8')),
      { embedder: { provider: 'openai', apiKey: 'test-key' } },
    );
    assert.equal(fs.statSync(configDir).mode & 0o777, 0o700);
    assert.equal(fs.statSync(path.join(configDir, 'config.json')).mode & 0o777, 0o600);
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
