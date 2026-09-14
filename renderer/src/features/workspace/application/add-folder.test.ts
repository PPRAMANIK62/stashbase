import { describe, expect, it, vi } from 'vite-plus/test';

import { folderPicker, projectApi, projectRegistrySnapshot } from '@/test/fakes/workspace';

import { addFolder } from './add-folder';

const snapshot = projectRegistrySnapshot({
  activeFolder: { name: 'Notes', path: '/project/notes' },
  homeDirectory: '/project',
  projects: [],
});

describe('authorize first folder', () => {
  it('opens only an explicitly selected folder', async () => {
    const openFolder = vi.fn(async () => snapshot);
    await expect(
      addFolder(
        folderPicker({
          chooseFolder: async () => ({ status: 'selected', folderPath: '/project/notes' }),
        }),
        projectApi({ openFolder }),
        new AbortController().signal,
      ),
    ).resolves.toEqual({ status: 'opened', snapshot });
    expect(openFolder).toHaveBeenCalledWith('/project/notes', expect.any(AbortSignal));
  });

  it('treats native cancellation as cancellation without opening', async () => {
    const openFolder = vi.fn();
    await expect(
      addFolder(folderPicker(), projectApi({ openFolder }), new AbortController().signal),
    ).resolves.toEqual({ status: 'cancelled' });
    expect(openFolder).not.toHaveBeenCalled();
  });

  it('starts new-folder selection from the requested location', async () => {
    const chooseFolder = vi.fn(async () => ({ status: 'cancelled' as const }));
    await addFolder(folderPicker({ chooseFolder }), projectApi(), new AbortController().signal, {
      defaultPath: '/home/person',
    });

    expect(chooseFolder).toHaveBeenCalledWith({ defaultPath: '/home/person' });
  });
});
