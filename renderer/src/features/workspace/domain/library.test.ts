import { describe, expect, it } from 'vite-plus/test';

import { displayFolderPath, folderName, isTemporaryFolderPath, parentFolderPath } from './library';

describe('library folder presentation', () => {
  it('derives folder names from POSIX and Windows paths', () => {
    expect(folderName('/home/person/Notes/')).toBe('Notes');
    expect(folderName('C:\\Users\\person\\Notes\\')).toBe('Notes');
  });

  it('names the directory a folder sits in, on either separator', () => {
    expect(parentFolderPath('/home/person/Notes/')).toBe('/home/person');
    expect(parentFolderPath('C:\\Users\\person\\Notes')).toBe('C:\\Users\\person');
    expect(parentFolderPath('/Notes')).toBe('/');
    expect(parentFolderPath('Notes')).toBe('Notes');
  });

  it('shortens only paths inside the user home', () => {
    expect(displayFolderPath('/home/person/Notes', '/home/person')).toBe('~/Notes');
    expect(displayFolderPath('/home/person-two/Notes', '/home/person')).toBe(
      '/home/person-two/Notes',
    );
  });

  it('recognizes the directories the system hands out for scratch work', () => {
    expect(isTemporaryFolderPath('/var/folders/zz/abc/T/stashbase-smoke-1')).toBe(true);
    expect(isTemporaryFolderPath('/private/var/folders/zz/abc/T/stashbase-smoke-1')).toBe(true);
    expect(isTemporaryFolderPath('/tmp/notes')).toBe(true);
    expect(isTemporaryFolderPath('/private/tmp/notes')).toBe(true);
    expect(isTemporaryFolderPath('C:\\Users\\person\\AppData\\Local\\Temp\\notes')).toBe(true);
    expect(isTemporaryFolderPath('/home/person/tmp')).toBe(false);
    expect(isTemporaryFolderPath('/home/person/var/folders/notes')).toBe(false);
  });
});
