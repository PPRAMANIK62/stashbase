import { describe, expect, it } from 'vite-plus/test';

import { displayFolderPath, folderName } from './library';

describe('library folder presentation', () => {
  it('derives folder names from POSIX and Windows paths', () => {
    expect(folderName('/home/person/Notes/')).toBe('Notes');
    expect(folderName('C:\\Users\\person\\Notes\\')).toBe('Notes');
  });

  it('shortens only paths inside the user home', () => {
    expect(displayFolderPath('/home/person/Notes', '/home/person')).toBe('~/Notes');
    expect(displayFolderPath('/home/person-two/Notes', '/home/person')).toBe(
      '/home/person-two/Notes',
    );
  });
});
