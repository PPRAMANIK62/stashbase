import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { LibraryError, type LibraryApi } from '@/features/workspace/application/ports';
import type { LibrarySnapshot } from '@/features/workspace/domain/library';

import { LibraryWelcome, type LibraryWelcomeProps } from './welcome';

const emptyLibrary: LibrarySnapshot = {
  activeFolder: null,
  homeDirectory: '/home/person',
  members: [],
};

type WelcomeTestProps = Omit<LibraryWelcomeProps, 'api'> & {
  api: Omit<LibraryApi, 'removeFolder'> & Partial<Pick<LibraryApi, 'removeFolder'>>;
};

function renderWelcome({ api, ...props }: WelcomeTestProps) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LibraryWelcome {...props} api={{ removeFolder: vi.fn(), ...api }} />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe('library welcome', () => {
  it('waits for membership before presenting first-run actions', () => {
    renderWelcome({
      folderPicker: { chooseFolder: vi.fn() },
      api: { load: () => new Promise(() => {}), openFolder: vi.fn() },
    });

    expect(screen.queryByRole('heading', { name: 'StashBase' })).toBeNull();
  });

  it('offers existing and new folder paths after membership settles', async () => {
    const chooseFolder = vi.fn(async () => ({ status: 'cancelled' as const }));
    renderWelcome({
      folderPicker: { chooseFolder },
      api: { load: vi.fn(async () => emptyLibrary), openFolder: vi.fn() },
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
    const opened: LibrarySnapshot = {
      ...emptyLibrary,
      activeFolder: { name: 'Research', path: '/home/person/Research' },
      members: [
        {
          favorite: false,
          openedAt: '2026-08-31T12:00:00.000Z',
          path: '/home/person/Research',
        },
      ],
    };
    const openFolder = vi.fn(async () => opened);
    renderWelcome({
      folderPicker: {
        chooseFolder: vi.fn(async () => ({
          folderPath: '/home/person/Research',
          status: 'selected' as const,
        })),
      },
      api: { load: vi.fn(async () => emptyLibrary), openFolder },
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Open folder' }));

    expect(screen.queryByRole('heading', { name: 'StashBase' })).toBeNull();
    expect(openFolder).toHaveBeenCalledWith('/home/person/Research', expect.any(AbortSignal));
  });

  it('presents every known member when no folder is active', async () => {
    const knownLibrary: LibrarySnapshot = {
      ...emptyLibrary,
      members: [
        {
          favorite: false,
          openedAt: '2026-08-31T12:00:00.000Z',
          path: '/home/person/Research',
        },
        {
          favorite: false,
          openedAt: '2026-08-30T12:00:00.000Z',
          path: '/home/person/Writing',
        },
      ],
    };
    const openedLibrary: LibrarySnapshot = {
      ...knownLibrary,
      activeFolder: { name: 'Writing', path: '/home/person/Writing' },
    };
    const openFolder = vi.fn(async () => openedLibrary);
    renderWelcome({
      folderPicker: { chooseFolder: vi.fn() },
      api: { load: vi.fn(async () => knownLibrary), openFolder },
    });

    expect(await screen.findByRole('heading', { name: 'Choose a folder' })).not.toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Writing/u }));

    expect(openFolder).toHaveBeenCalledWith('/home/person/Writing', expect.any(AbortSignal));
    expect(screen.queryByRole('heading', { name: 'StashBase' })).toBeNull();
  });

  it('keeps open failure local and allows another attempt', async () => {
    const opened: LibrarySnapshot = {
      ...emptyLibrary,
      activeFolder: { name: 'Notes', path: '/home/person/Notes' },
    };
    const openFolder = vi
      .fn()
      .mockRejectedValueOnce(new LibraryError('unavailable', 'The library is unavailable.'))
      .mockResolvedValue(opened);
    renderWelcome({
      folderPicker: {
        chooseFolder: vi.fn(async () => ({
          folderPath: '/home/person/Notes',
          status: 'selected' as const,
        })),
      },
      api: { load: vi.fn(async () => emptyLibrary), openFolder },
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Open folder' }));
    expect((await screen.findByRole('alert')).textContent).toContain('The library is unavailable.');

    await user.click(screen.getByRole('button', { name: 'Open folder' }));
    expect(screen.queryByRole('heading', { name: 'StashBase' })).toBeNull();
    expect(openFolder).toHaveBeenCalledTimes(2);
  });
});
