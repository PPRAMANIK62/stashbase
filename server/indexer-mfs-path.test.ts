import assert from 'node:assert/strict';
import test from 'node:test';
import { createFilesystemPath } from './filesystem-path.ts';
import { retainedIndexedSource } from './indexer.mfs.ts';

const windowsPath = createFilesystemPath({ platform: 'win32', cwd: 'C:/' });

test('legacy source spelling is rebased by the Node-owned Windows identity', () => {
  assert.equal(
    retainedIndexedSource(
      'c:/users/alice',
      'C:/Users/Alice/Docs/File.md',
      ['c:/users/alice'],
      windowsPath,
    ),
    'c:/users/alice/Docs/File.md',
  );
});

test('longest member root owns legacy source spelling migration', () => {
  assert.equal(
    retainedIndexedSource(
      'c:/library',
      'C:/Library/Nested/File.md',
      ['c:/library', 'c:/library/nested'],
      windowsPath,
    ),
    null,
  );
  assert.equal(
    retainedIndexedSource(
      'c:/library/nested',
      'C:/Library/Nested/File.md',
      ['c:/library', 'c:/library/nested'],
      windowsPath,
    ),
    'c:/library/nested/File.md',
  );
});

test('Unicode identity is evaluated only by Node, including Unicode 16 case pairs', () => {
  const garayUpper = '\u{10D50}';
  const garayLower = '\u{10D70}';
  assert.equal(
    windowsPath.identity(`C:/${garayUpper}`),
    windowsPath.identity(`c:/${garayLower}`),
  );
});
