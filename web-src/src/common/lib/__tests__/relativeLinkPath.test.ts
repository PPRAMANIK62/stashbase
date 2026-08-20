import assert from 'node:assert/strict';
import test from 'node:test';
import { relativeLinkPath } from '@/common/lib/relativeLinkPath.ts';

test('relativeLinkPath: same directory has no leading ./ segment', () => {
  assert.equal(relativeLinkPath('notes/current.md', 'notes/other.pdf'), 'other.pdf');
  assert.equal(relativeLinkPath('current.md', 'other.pdf'), 'other.pdf');
});

test('relativeLinkPath: target in a subdirectory descends without ..', () => {
  assert.equal(relativeLinkPath('notes/current.md', 'notes/sub/img.png'), 'sub/img.png');
});

test('relativeLinkPath: target in a parent/sibling directory needs ..', () => {
  assert.equal(relativeLinkPath('notes/project/a.md', 'assets/diagram.png'), '../../assets/diagram.png');
  assert.equal(relativeLinkPath('notes/project/a.md', 'notes/other/diagram.png'), '../other/diagram.png');
});

test('relativeLinkPath: target several levels up from a deeply nested note', () => {
  assert.equal(relativeLinkPath('a/b/c/note.md', 'x.pdf'), '../../../x.pdf');
  assert.equal(relativeLinkPath('a/b/c/note.md', 'a/x.pdf'), '../../x.pdf');
});
