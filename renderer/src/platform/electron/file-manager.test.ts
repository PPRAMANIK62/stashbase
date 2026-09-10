import { describe, expect, it } from 'vite-plus/test';

import { fileManagerLabel } from './file-manager';

describe('file manager label', () => {
  it('uses the host platform vocabulary', () => {
    expect(fileManagerLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X)')).toBe('Show in Finder');
    expect(fileManagerLabel('Mozilla/5.0 (Windows NT 10.0)')).toBe('Show in File Explorer');
    expect(fileManagerLabel('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Show in file manager');
  });
});
