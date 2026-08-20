import assert from 'node:assert/strict';
import test from 'node:test';
import { linkFileInsertionText } from '@/features/documents/milkdown/linkFileInsertion.ts';

test('linkFileInsertionText: basename display, note-relative encoded href', () => {
  assert.deepEqual(linkFileInsertionText('notes/current.md', 'notes/Other note.md'), {
    displayName: 'Other note.md',
    href: 'Other%20note.md',
  });
});

test('linkFileInsertionText: target in a different directory produces ../ segments', () => {
  assert.deepEqual(linkFileInsertionText('notes/project/a.md', 'assets/diagram.png'), {
    displayName: 'diagram.png',
    href: '../../assets/diagram.png',
  });
});

test('linkFileInsertionText: every path segment is percent-encoded, not just the basename', () => {
  assert.deepEqual(linkFileInsertionText('a.md', 'sub folder/report card.pdf'), {
    displayName: 'report card.pdf',
    href: 'sub%20folder/report%20card.pdf',
  });
});
