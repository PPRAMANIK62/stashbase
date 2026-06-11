import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateKbRootTarget } from './space.ts';

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `stashbase-${label}-`));
}

test('KB root validation accepts an existing writable directory', () => {
  const root = tmpDir('kb-root');
  assert.equal(validateKbRootTarget(root), path.resolve(root));
});

test('KB root validation accepts a new folder under an existing writable parent', () => {
  const parent = tmpDir('kb-root-parent');
  const root = path.join(parent, 'StashBase');
  assert.equal(validateKbRootTarget(root), path.resolve(root));
  assert.equal(fs.existsSync(root), false);
});

test('KB root validation rejects a file path', () => {
  const parent = tmpDir('kb-root-file');
  const file = path.join(parent, 'not-a-folder');
  fs.writeFileSync(file, 'nope\n');

  assert.throws(
    () => validateKbRootTarget(file),
    /path is not a directory/,
  );
});

test('KB root validation rejects missing parents', () => {
  const parent = tmpDir('kb-root-missing-parent');
  const root = path.join(parent, 'missing', 'StashBase');

  assert.throws(
    () => validateKbRootTarget(root),
    /parent directory does not exist/,
  );
});

test('KB root validation rejects unwritable existing directories', { skip: process.platform === 'win32' }, () => {
  const root = tmpDir('kb-root-readonly');
  fs.chmodSync(root, 0o500);
  try {
    assert.throws(
      () => validateKbRootTarget(root),
      /directory is not writable/,
    );
  } finally {
    fs.chmodSync(root, 0o700);
  }
});
