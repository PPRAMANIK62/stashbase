import { describe, expect, it, vi } from 'vite-plus/test';

import { addFolder } from './add-folder';

const snapshot = {
  activeFolder: { name: 'Notes', path: '/library/notes' },
  homeDirectory: '/library',
  members: [],
};

describe('authorize first folder', () => {
  it('opens only an explicitly selected folder', async () => {
    const openFolder = vi.fn(async () => snapshot);
    await expect(
      addFolder(
        { chooseFolder: async () => ({ status: 'selected', folderPath: '/library/notes' }) },
        { load: vi.fn(), openFolder, removeFolder: vi.fn() },
        new AbortController().signal,
      ),
    ).resolves.toEqual({ status: 'opened', snapshot });
    expect(openFolder).toHaveBeenCalledWith('/library/notes', expect.any(AbortSignal));
  });

  it('treats native cancellation as cancellation without opening', async () => {
    const openFolder = vi.fn();
    await expect(
      addFolder(
        { chooseFolder: async () => ({ status: 'cancelled' }) },
        { load: vi.fn(), openFolder, removeFolder: vi.fn() },
        new AbortController().signal,
      ),
    ).resolves.toEqual({ status: 'cancelled' });
    expect(openFolder).not.toHaveBeenCalled();
  });

  it('starts new-folder selection from the requested location', async () => {
    const chooseFolder = vi.fn(async () => ({ status: 'cancelled' as const }));
    await addFolder(
      { chooseFolder },
      { load: vi.fn(), openFolder: vi.fn(), removeFolder: vi.fn() },
      new AbortController().signal,
      { defaultPath: '/home/person' },
    );

    expect(chooseFolder).toHaveBeenCalledWith({ defaultPath: '/home/person' });
  });
});
