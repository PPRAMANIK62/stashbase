import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { LibraryPort } from '@/features/workspace/application/ports';
import {
  folderPicker,
  githubImportApi,
  libraryApi,
  libraryLifecycle,
  librarySnapshot,
  pendingLibraryApi,
} from '@/test/fakes/workspace';
import { withQueryClient } from '@/test/query';

import { LibrarySidebar, type LibrarySidebarProps } from './sidebar';

const emptyLibrary = librarySnapshot({
  activeFolder: null,
  homeDirectory: '/library',
  members: [],
});

const RESEARCH = { name: 'Research', path: '/library/research' };
const researchMember = {
  favorite: false,
  openedAt: '2026-08-31T12:00:00.000Z',
  path: RESEARCH.path,
};
const activeLibrary = librarySnapshot({
  ...emptyLibrary,
  activeFolder: RESEARCH,
  members: [researchMember],
});

type SidebarTestProps = Omit<
  LibrarySidebarProps,
  'api' | 'folderPicker' | 'githubImport' | 'lifecycle'
> & {
  api: Partial<LibraryPort>;
  folderPicker?: LibrarySidebarProps['folderPicker'];
  githubImport?: LibrarySidebarProps['githubImport'];
  lifecycle?: LibrarySidebarProps['lifecycle'];
};

function renderLibrary({
  api,
  folderPicker: picker,
  githubImport,
  lifecycle,
  ...props
}: SidebarTestProps) {
  return withQueryClient(
    <LibrarySidebar
      {...props}
      api={libraryApi(api)}
      folderPicker={picker ?? folderPicker()}
      githubImport={githubImport ?? githubImportApi()}
      lifecycle={lifecycle ?? libraryLifecycle()}
    />,
  );
}

afterEach(cleanup);

describe('library sidebar', () => {
  it('does not claim the library is empty before membership resolves', () => {
    renderLibrary({ api: pendingLibraryApi() });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the authoritative active folder', async () => {
    renderLibrary({ api: { load: vi.fn(async () => activeLibrary) } });

    expect(
      (await screen.findByRole('button', { name: 'Research' })).getAttribute('aria-current'),
    ).toBe('page');
  });

  it('adds a non-color attention cue to the active folder when asked', async () => {
    renderLibrary({ attention: true, api: { load: vi.fn(async () => activeLibrary) } });

    const button = await screen.findByRole('button', { name: 'Research Needs attention' });
    // The accessible name above already proves the sr-only cue; `data-folder-attention` marks the
    // separate visual dot, which carries no role or label of its own to query instead.
    expect(button.querySelector('[data-folder-attention]')).not.toBeNull(); // dom-contract: see comment above
  });

  it('exposes local retry after membership failure', async () => {
    const load = vi
      .fn<LibraryPort['load']>()
      .mockRejectedValueOnce(new Error('server offline'))
      .mockResolvedValue(emptyLibrary);
    renderLibrary({ api: { load } });

    expect((await screen.findByRole('alert')).textContent).toContain('Library unavailable.');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('does not represent an inactive member as the active folder', async () => {
    renderLibrary({
      api: {
        load: vi.fn(async () =>
          librarySnapshot({
            ...emptyLibrary,
            members: [{ ...researchMember, path: '/library/notes' }],
          }),
        ),
      },
    });
    await waitFor(() => expect(screen.queryByRole('button')).toBeNull());
  });

  it('lists every member from the scoped query and selects another folder', async () => {
    const listed = librarySnapshot({
      ...activeLibrary,
      members: [
        researchMember,
        { favorite: false, openedAt: '2026-08-30T12:00:00.000Z', path: '/library/notes' },
      ],
    });
    const selectedLibrary = librarySnapshot({
      ...listed,
      activeFolder: { name: 'notes', path: '/library/notes' },
    });
    const openFolder = vi.fn(async () => selectedLibrary);
    renderLibrary({ api: { load: vi.fn(async () => listed), openFolder } });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Research' }));

    expect(await screen.findByTitle('~/research')).not.toBeNull();
    await user.click(screen.getByTitle('~/notes'));

    expect(openFolder).toHaveBeenCalledWith('/library/notes', expect.any(AbortSignal));
    expect(await screen.findByRole('button', { name: 'notes' })).not.toBeNull();
  });

  it('adds a subsequent folder from the active-folder chooser', async () => {
    const addedLibrary = librarySnapshot({
      ...activeLibrary,
      activeFolder: { name: 'Writing', path: '/library/writing' },
      members: [
        { favorite: false, openedAt: '2026-08-31T12:05:00.000Z', path: '/library/writing' },
        ...activeLibrary.members,
      ],
    });
    const chooseFolder = vi.fn(async () => ({
      status: 'selected' as const,
      folderPath: '/library/writing',
    }));
    const openFolder = vi.fn(async () => addedLibrary);
    renderLibrary({
      api: { load: vi.fn(async () => activeLibrary), openFolder },
      folderPicker: folderPicker({ chooseFolder }),
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Research' }));
    await user.click(await screen.findByRole('menuitem', { hidden: true, name: 'Open folder' }));

    expect(chooseFolder).toHaveBeenCalledWith(undefined);
    expect(openFolder).toHaveBeenCalledWith('/library/writing', expect.any(AbortSignal));
    expect(await screen.findByRole('button', { name: 'Writing' })).not.toBeNull();
  });

  it('uses a trailing folder action and confirms the complete retained path', async () => {
    const homeLibrary = librarySnapshot({
      activeFolder: { name: 'Research', path: '/home/person/Research' },
      homeDirectory: '/home/person',
      members: [
        { favorite: false, openedAt: '2026-08-31T12:00:00.000Z', path: '/home/person/Research' },
        { favorite: false, openedAt: '2026-08-30T12:00:00.000Z', path: '/home/person/Notes' },
      ],
    });
    const removeFolder = vi.fn(async () =>
      librarySnapshot({ ...homeLibrary, members: homeLibrary.members.slice(0, 1) }),
    );
    const prepareFolderRemoval = vi.fn(async () => true);
    const notifyFolderRemoved = vi.fn(async () => undefined);
    renderLibrary({
      api: { load: vi.fn(async () => homeLibrary), removeFolder },
      lifecycle: libraryLifecycle({ notifyFolderRemoved, prepareFolderRemoval }),
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Research' }));
    expect(
      (await screen.findByRole('menuitemradio', { name: 'Notes' })).getAttribute(
        'aria-keyshortcuts',
      ),
    ).toBe('Delete');
    await user.click(await screen.findByRole('button', { name: 'Remove Notes from Library' }));

    expect(await screen.findByRole('heading', { name: 'Remove from Library?' })).not.toBeNull();
    expect(screen.getByText('~/Notes').getAttribute('title')).toBe('/home/person/Notes');
    expect(screen.getByText(/The folder and its files will stay on disk/u)).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(removeFolder).toHaveBeenCalledOnce());
    expect(prepareFolderRemoval).toHaveBeenCalledWith('/home/person/Notes');
    expect(removeFolder).toHaveBeenCalledWith('/home/person/Notes', expect.any(AbortSignal));
    expect(notifyFolderRemoved).toHaveBeenCalledWith('/home/person/Notes');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
