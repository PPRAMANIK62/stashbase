import { describe, expect, it } from 'vite-plus/test';

import { resolveDocumentLink } from './link-target';

const owner = { folderPath: '/library/notes', path: 'guides/current.md' };

describe('document link navigation', () => {
  it('resolves relative files and anchors from the owning source identity', () => {
    expect(resolveDocumentLink('../Other%20note.md#part', owner)).toEqual({
      anchor: 'part',
      kind: 'source',
      source: { folderPath: '/library/notes', path: 'Other note.md' },
    });
    expect(resolveDocumentLink('#R%C3%A9sum%C3%A9', owner)).toEqual({
      id: 'Résumé',
      kind: 'anchor',
    });
  });

  it('retains an out-of-folder source folder instead of rebinding to the active folder', () => {
    expect(
      resolveDocumentLink('sibling.md', {
        folderPath: '/library/archive',
        path: 'guides/current.md',
      }),
    ).toEqual({
      kind: 'source',
      source: { folderPath: '/library/archive', path: 'guides/sibling.md' },
    });
  });

  it('rejects escapes, encoded separators, credentials, and non-HTTP schemes', () => {
    for (const href of [
      '../../outside.md',
      '..%2Foutside.md',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'https://person:secret@example.com',
      '//example.com/path',
    ]) {
      expect(resolveDocumentLink(href, owner)).toEqual({ kind: 'ignore' });
    }
  });

  it('allows explicit HTTP(S) URLs and generic local source identities', () => {
    expect(resolveDocumentLink('https://example.com/a', owner)).toEqual({
      href: 'https://example.com/a',
      kind: 'external',
    });
    expect(resolveDocumentLink('../archive.zip', owner)).toEqual({
      kind: 'source',
      source: { folderPath: '/library/notes', path: 'archive.zip' },
    });
  });
});
