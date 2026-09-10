import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { libraryFailureMessage } from '@/features/workspace/application/failure-messages';
import { LibraryError, type LibraryPort } from '@/features/workspace/application/ports';
import {
  folderPicker,
  githubImportApi,
  libraryApi,
  librarySnapshot,
  pendingLibraryApi,
} from '@/test/fakes/workspace';
import { withQueryClient } from '@/test/query';

import { LibraryWelcome, type LibraryWelcomeProps } from './welcome';

const emptyLibrary = librarySnapshot({ activeFolder: null, members: [] });

type WelcomeTestProps = Omit<LibraryWelcomeProps, 'api' | 'folderPicker' | 'githubImport'> & {
  api: Partial<LibraryPort>;
  folderPicker?: LibraryWelcomeProps['folderPicker'];
  githubImport?: LibraryWelcomeProps['githubImport'];
};

function renderWelcome({ api, folderPicker: picker, githubImport, ...props }: WelcomeTestProps) {
  return withQueryClient(
    <LibraryWelcome
      {...props}
      api={libraryApi(api)}
      folderPicker={picker ?? folderPicker()}
      githubImport={githubImport ?? githubImportApi()}
    />,
  );
}

afterEach(cleanup);

describe('library welcome', () => {
  it('waits for membership before presenting first-run actions', () => {
    renderWelcome({ api: pendingLibraryApi() });

    expect(screen.queryByRole('heading', { name: 'StashBase' })).toBeNull();
  });

  it('offers existing and new folder paths after membership settles', async () => {
    const chooseFolder = vi.fn(async () => ({ status: 'cancelled' as const }));
    renderWelcome({
      api: { load: vi.fn(async () => emptyLibrary) },
      folderPicker: folderPicker({ chooseFolder }),
    });

    const user = userEvent.setup();
    expect(await screen.findByRole('heading', { level: 1, name: 'StashBase' })).not.toBeNull();
    expect(
      screen.getByText(
        'Turn your local files into Agent-ready context without moving them out of your folders.',
      ),
    ).not.toBeNull();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Choose a folder to begin' }),
    ).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open folder' }));
    expect(chooseFolder).toHaveBeenLastCalledWith(undefined);

    await user.click(screen.getByRole('button', { name: 'Create folder' }));
    expect(chooseFolder).toHaveBeenLastCalledWith({ defaultPath: '/home/person' });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('opens the selected folder and leaves the welcome state', async () => {
    const opened = librarySnapshot({
      ...emptyLibrary,
      activeFolder: { name: 'Research', path: '/home/person/Research' },
      members: [
        { favorite: false, openedAt: '2026-08-31T12:00:00.000Z', path: '/home/person/Research' },
      ],
    });
    const openFolder = vi.fn(async () => opened);
    renderWelcome({
      api: { load: vi.fn(async () => emptyLibrary), openFolder },
      folderPicker: folderPicker({
        chooseFolder: vi.fn(async () => ({
          folderPath: '/home/person/Research',
          status: 'selected' as const,
        })),
      }),
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Open folder' }));

    expect(screen.queryByRole('heading', { name: 'StashBase' })).toBeNull();
    expect(openFolder).toHaveBeenCalledWith('/home/person/Research', expect.any(AbortSignal));
  });

  it('presents every known member when no folder is active', async () => {
    const knownLibrary = librarySnapshot({
      ...emptyLibrary,
      members: [
        { favorite: false, openedAt: '2026-08-31T12:00:00.000Z', path: '/home/person/Research' },
        { favorite: false, openedAt: '2026-08-30T12:00:00.000Z', path: '/home/person/Writing' },
      ],
    });
    const openedLibrary = librarySnapshot({
      ...knownLibrary,
      activeFolder: { name: 'Writing', path: '/home/person/Writing' },
    });
    const openFolder = vi.fn(async () => openedLibrary);
    renderWelcome({ api: { load: vi.fn(async () => knownLibrary), openFolder } });

    expect(await screen.findByRole('heading', { name: 'Choose a folder' })).not.toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Writing/u }));

    expect(openFolder).toHaveBeenCalledWith('/home/person/Writing', expect.any(AbortSignal));
    expect(screen.queryByRole('heading', { name: 'StashBase' })).toBeNull();
  });

  it('keeps open failure local and allows another attempt', async () => {
    const opened = librarySnapshot({
      ...emptyLibrary,
      activeFolder: { name: 'Notes', path: '/home/person/Notes' },
    });
    const openFolder = vi
      .fn<LibraryPort['openFolder']>()
      .mockRejectedValueOnce(new LibraryError('unavailable', 'HTTP 503 from /api/library'))
      .mockResolvedValue(opened);
    renderWelcome({
      api: { load: vi.fn(async () => emptyLibrary), openFolder },
      folderPicker: folderPicker({
        chooseFolder: vi.fn(async () => ({
          folderPath: '/home/person/Notes',
          status: 'selected' as const,
        })),
      }),
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Open folder' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      libraryFailureMessage('unavailable', 'opened'),
    );

    await user.click(screen.getByRole('button', { name: 'Open folder' }));
    expect(screen.queryByRole('heading', { name: 'StashBase' })).toBeNull();
    expect(openFolder).toHaveBeenCalledTimes(2);
  });
});
