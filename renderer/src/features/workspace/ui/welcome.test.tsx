import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { libraryFailureMessage } from '@/features/workspace/application/failure-messages';
import { LibraryError, type LibraryPort } from '@/features/workspace/application/ports';
import {
  folderPicker,
  githubImportApi,
  libraryApi,
  libraryLifecycle,
  librarySnapshot,
  pendingLibraryApi,
} from '@/test/fakes/workspace';
import { withQueryClient } from '@/test/query';

import { LibraryWelcome, type LibraryWelcomeProps } from './welcome';

const emptyLibrary = librarySnapshot({ activeFolder: null, members: [] });

type WelcomeTestProps = Omit<
  LibraryWelcomeProps,
  'api' | 'folderPicker' | 'githubImport' | 'lifecycle'
> & {
  api: Partial<LibraryPort>;
  folderPicker?: LibraryWelcomeProps['folderPicker'];
  githubImport?: LibraryWelcomeProps['githubImport'];
  lifecycle?: LibraryWelcomeProps['lifecycle'];
};

function renderWelcome({
  api,
  folderPicker: picker,
  githubImport,
  lifecycle,
  ...props
}: WelcomeTestProps) {
  return withQueryClient(
    <LibraryWelcome
      {...props}
      api={libraryApi(api)}
      folderPicker={picker ?? folderPicker()}
      githubImport={githubImport ?? githubImportApi()}
      lifecycle={lifecycle ?? libraryLifecycle()}
    />,
  );
}

function recentList() {
  return within(screen.getByRole('list', { name: 'Recent folders' }));
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
        'Turn your local files into a wiki, then write with Claude Code and Codex using your own sources.',
      ),
    ).not.toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Recent' })).not.toBeNull();
    expect(screen.getByText('Folders you open will be listed here.')).not.toBeNull();
    expect(screen.queryByRole('list', { name: 'Recent folders' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open folder as a project' }));
    expect(chooseFolder).toHaveBeenLastCalledWith(undefined);

    await user.click(screen.getByRole('button', { name: 'Create a new project' }));
    expect(chooseFolder).toHaveBeenLastCalledWith({
      defaultPath: '/home/person',
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('opens the selected folder and leaves the welcome state', async () => {
    const opened = librarySnapshot({
      ...emptyLibrary,
      activeFolder: { name: 'Research', path: '/home/person/Research' },
      members: [
        {
          favorite: false,
          openedAt: '2026-08-31T12:00:00.000Z',
          path: '/home/person/Research',
        },
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
    await user.click(await screen.findByRole('button', { name: 'Open folder as a project' }));

    expect(screen.queryByRole('heading', { name: 'StashBase' })).toBeNull();
    expect(openFolder).toHaveBeenCalledWith('/home/person/Research', expect.any(AbortSignal));
  });

  it('presents every known member when no folder is active', async () => {
    const knownLibrary = librarySnapshot({
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
    });
    const openedLibrary = librarySnapshot({
      ...knownLibrary,
      activeFolder: { name: 'Writing', path: '/home/person/Writing' },
    });
    const openFolder = vi.fn(async () => openedLibrary);
    renderWelcome({
      api: { load: vi.fn(async () => knownLibrary), openFolder },
    });

    expect(await screen.findByRole('heading', { name: 'Recent' })).not.toBeNull();
    expect(recentList().getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByText('Folders you open will be listed here.')).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^Writing/u }));

    expect(openFolder).toHaveBeenCalledWith('/home/person/Writing', expect.any(AbortSignal));
    expect(screen.queryByRole('heading', { name: 'StashBase' })).toBeNull();
  });

  it('keeps the temporary directories a smoke test registers out of the list', async () => {
    const knownLibrary = librarySnapshot({
      ...emptyLibrary,
      members: [
        {
          favorite: false,
          openedAt: '2026-09-01T12:00:00.000Z',
          path: '/var/folders/zz/abc/T/stashbase-smoke-1',
        },
        {
          favorite: false,
          openedAt: '2026-08-31T12:00:00.000Z',
          path: '/home/person/Research',
        },
      ],
    });
    renderWelcome({ api: { load: vi.fn(async () => knownLibrary) } });

    expect(await screen.findByRole('list', { name: 'Recent folders' })).not.toBeNull();
    expect(recentList().getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /stashbase-smoke/u })).toBeNull();
  });

  it('removes a recent folder from the Library through its row menu', async () => {
    const knownLibrary = librarySnapshot({
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
          path: '/home/person/Notes',
        },
      ],
    });
    const removeFolder = vi.fn(async () =>
      librarySnapshot({
        ...knownLibrary,
        members: knownLibrary.members.slice(0, 1),
      }),
    );
    const prepareFolderRemoval = vi.fn(async () => true);
    renderWelcome({
      api: { load: vi.fn(async () => knownLibrary), removeFolder },
      lifecycle: libraryLifecycle({ prepareFolderRemoval }),
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Actions for Notes' }));
    await user.click(
      await screen.findByRole('menuitem', {
        hidden: true,
        name: 'Remove from Library',
      }),
    );

    expect(await screen.findByRole('heading', { name: 'Remove from Library?' })).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() =>
      expect(removeFolder).toHaveBeenCalledWith('/home/person/Notes', expect.any(AbortSignal)),
    );
    expect(prepareFolderRemoval).toHaveBeenCalledWith('/home/person/Notes');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(recentList().getAllByRole('listitem')).toHaveLength(1);
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
    await user.click(await screen.findByRole('button', { name: 'Open folder as a project' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      libraryFailureMessage('unavailable', 'opened'),
    );

    await user.click(screen.getByRole('button', { name: 'Open folder as a project' }));
    expect(screen.queryByRole('heading', { name: 'StashBase' })).toBeNull();
    expect(openFolder).toHaveBeenCalledTimes(2);
  });

  it('renders the Gallery band it is handed and stands without one', async () => {
    const withBand = renderWelcome({
      api: { load: vi.fn(async () => emptyLibrary) },
      gallery: <p>Widget Handbook</p>,
    });

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Or start from a project in the Gallery',
      }),
    ).not.toBeNull();
    expect(screen.getByText('Widget Handbook')).not.toBeNull();
    withBand.unmount();

    renderWelcome({ api: { load: vi.fn(async () => emptyLibrary) } });
    expect(await screen.findByRole('heading', { level: 1, name: 'StashBase' })).not.toBeNull();
    expect(
      screen.queryByRole('heading', {
        name: 'Or start from a project in the Gallery',
      }),
    ).toBeNull();
  });
});
