import { describe, expect, it } from 'vite-plus/test';

import { filesChanged } from './files-changed';

const folder = { kind: 'folder', path: '/library/Research' } as const;

describe('filesChanged', () => {
  it('reports nothing when a settled write named no paths', () => {
    expect(filesChanged(folder, [])).toBeNull();
  });

  it('reports each path once, under the scope the write was observed in', () => {
    const change = filesChanged(folder, ['notes.md', 'notes.md', 'papers/study.pdf']);

    expect(change).toEqual({
      paths: ['notes.md', 'papers/study.pdf'],
      scope: folder,
      sources: [
        { folderPath: folder.path, path: 'notes.md' },
        { folderPath: folder.path, path: 'papers/study.pdf' },
      ],
    });
  });

  it('keeps a path that resolves to no source inside the folder out of the sources', () => {
    const change = filesChanged(folder, ['/elsewhere/notes.md']);

    expect(change?.paths).toEqual(['/elsewhere/notes.md']);
    expect(change?.sources).toEqual([]);
  });

  it('names no source at all for a library-scoped write', () => {
    const change = filesChanged({ kind: 'library' }, ['notes.md']);

    expect(change?.scope).toEqual({ kind: 'library' });
    expect(change?.sources).toEqual([]);
  });
});
