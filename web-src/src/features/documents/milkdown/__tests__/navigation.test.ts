import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMilkdownLink } from '@/features/documents/milkdown/navigation.ts';

test('Milkdown links stay inside the workspace and preserve heading fragments', () => {
  assert.deepEqual(resolveMilkdownLink('../Other%20note.md#part', 'notes/current.md'), {
    kind: 'library-file', path: 'Other note.md', anchor: 'part',
  });
  assert.deepEqual(resolveMilkdownLink('#part', 'notes/current.md'), { kind: 'anchor', id: 'part' });
});

test('Milkdown links reject encoded separators and allow only HTTP(S) externally', () => {
  assert.deepEqual(resolveMilkdownLink('%2Fsecret.md', 'notes/current.md'), { kind: 'ignore' });
  assert.deepEqual(resolveMilkdownLink('javascript:alert(1)', 'notes/current.md'), { kind: 'ignore' });
  assert.deepEqual(resolveMilkdownLink('file:///etc/passwd', 'notes/current.md'), { kind: 'ignore' });
  assert.deepEqual(resolveMilkdownLink('https://example.com/a', 'notes/current.md'), {
    kind: 'external', href: 'https://example.com/a',
  });
});

test('Milkdown local links to viewer-supported library files resolve, not just notes', () => {
  assert.deepEqual(resolveMilkdownLink('photo.png', 'notes/current.md'), {
    kind: 'library-file', path: 'notes/photo.png', anchor: undefined,
  });
  assert.deepEqual(resolveMilkdownLink('manual.pdf', 'notes/current.md'), {
    kind: 'library-file', path: 'notes/manual.pdf', anchor: undefined,
  });
  assert.deepEqual(resolveMilkdownLink('report.docx', 'notes/current.md'), {
    kind: 'library-file', path: 'notes/report.docx', anchor: undefined,
  });
  assert.deepEqual(resolveMilkdownLink('clip.mp3', 'notes/current.md'), {
    kind: 'library-file', path: 'notes/clip.mp3', anchor: undefined,
  });
  assert.deepEqual(resolveMilkdownLink('clip.mp4', 'notes/current.md'), {
    kind: 'library-file', path: 'notes/clip.mp4', anchor: undefined,
  });
});

test('Milkdown links to generic workspace files navigate to an honest placeholder', () => {
  assert.deepEqual(resolveMilkdownLink('archive.zip', 'notes/current.md'), {
    kind: 'library-file', path: 'notes/archive.zip', anchor: undefined,
  });
});

test('links inside an out-of-folder document resolve back to that member folder', () => {
  // Relative link: inherits the base URL's __folder token.
  assert.deepEqual(resolveMilkdownLink('sibling.md', 'notes/current.md', '/Users/a/Other'), {
    kind: 'library-file', path: 'notes/sibling.md', anchor: undefined, folder: '/Users/a/Other',
  });
  // Anchors and externals are unaffected by the folder context.
  assert.deepEqual(resolveMilkdownLink('#part', 'notes/current.md', '/Users/a/Other'), { kind: 'anchor', id: 'part' });
  assert.deepEqual(resolveMilkdownLink('https://example.com/a', 'notes/current.md', '/Users/a/Other'), {
    kind: 'external', href: 'https://example.com/a',
  });
});

test('path-traversal rejection applies identically regardless of extension', () => {
  // Same guard as `.md` targets: an encoded `..` segment anywhere in the
  // decoded path is rejected before the extension is ever consulted.
  assert.deepEqual(resolveMilkdownLink('..%2F..%2Fetc%2Fpasswd.pdf', 'notes/current.md'), { kind: 'ignore' });
});
