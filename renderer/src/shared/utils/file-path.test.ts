import { describe, expect, it } from 'vite-plus/test';

import { basePathName, fileExtensionOf, parentPathOf } from './file-path';

describe('basePathName', () => {
  it('names the last segment of a relative or absolute path', () => {
    expect(basePathName('notes.md')).toBe('notes.md');
    expect(basePathName('docs/notes.md')).toBe('notes.md');
    expect(basePathName('/Users/me/docs/notes.md')).toBe('notes.md');
  });

  it('reads a Windows path, because a path can arrive from a Windows host', () => {
    expect(basePathName('C:\\Users\\me\\docs\\notes.md')).toBe('notes.md');
    expect(basePathName('docs\\notes.md')).toBe('notes.md');
  });

  it('names the folder rather than the empty segment after a trailing separator', () => {
    expect(basePathName('docs/')).toBe('docs');
    expect(basePathName('docs///')).toBe('docs');
    expect(basePathName('C:\\docs\\')).toBe('docs');
  });

  it('falls back to the path when no segment is left to name', () => {
    expect(basePathName('/')).toBe('/');
    expect(basePathName('')).toBe('');
  });
});

describe('parentPathOf', () => {
  it('answers where an entry sits', () => {
    expect(parentPathOf('docs/notes.md')).toBe('docs');
    expect(parentPathOf('a/b/c.md')).toBe('a/b');
    expect(parentPathOf('C:\\Users\\me\\notes.md')).toBe('C:\\Users\\me');
  });

  it('is empty at the top of a folder, and does not guess a name', () => {
    expect(parentPathOf('notes.md')).toBe('');
    expect(parentPathOf('')).toBe('');
  });

  it('ignores a trailing separator before looking for the parent', () => {
    expect(parentPathOf('a/b/')).toBe('a');
  });
});

describe('fileExtensionOf', () => {
  it('lowercases the extension and drops the dot', () => {
    expect(fileExtensionOf('docs/Report.PDF')).toBe('pdf');
    expect(fileExtensionOf('notes.md')).toBe('md');
    expect(fileExtensionOf('archive.tar.gz')).toBe('gz');
  });

  it('treats a dotfile as a name with no extension', () => {
    expect(fileExtensionOf('.gitignore')).toBe('');
    expect(fileExtensionOf('docs/.env')).toBe('');
  });

  it('is empty when the name carries no extension', () => {
    expect(fileExtensionOf('docs/README')).toBe('');
  });
});
