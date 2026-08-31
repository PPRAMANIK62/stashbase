import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { LibrarySnapshot } from '@/features/workspace/domain/library';

import { LibrarySidebar, type LibrarySidebarProps } from './sidebar';

const emptyLibrary: LibrarySnapshot = {
  activeFolder: null,
  homeDirectory: '/library',
  members: [],
};

function renderLibrary(props: LibrarySidebarProps) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LibrarySidebar {...props} />
    </QueryClientProvider>,
  );
}

describe('library sidebar', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        addEventListener: vi.fn(),
        matches: false,
        media: '',
        removeEventListener: vi.fn(),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('does not claim the library is empty before membership resolves', () => {
    renderLibrary({
      folderPicker: { chooseFolder: vi.fn() },
      api: {
        load: () => new Promise(() => {}),
        openFolder: vi.fn(),
      },
    });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the authoritative active folder', async () => {
    const activeLibrary: LibrarySnapshot = {
      ...emptyLibrary,
      activeFolder: { name: 'Research', path: '/library/research' },
      members: [
        { favorite: false, openedAt: '2026-08-31T12:00:00.000Z', path: '/library/research' },
      ],
    };
    renderLibrary({
      folderPicker: { chooseFolder: vi.fn() },
      api: { load: vi.fn(async () => activeLibrary), openFolder: vi.fn() },
    });

    expect(
      (await screen.findByRole('button', { name: 'Research' })).getAttribute('aria-current'),
    ).toBe('page');
  });

  it('exposes local retry after membership failure', async () => {
    const load = vi
      .fn<() => Promise<LibrarySnapshot>>()
      .mockRejectedValueOnce(new Error('server offline'))
      .mockResolvedValue(emptyLibrary);
    renderLibrary({
      folderPicker: { chooseFolder: vi.fn() },
      api: { load, openFolder: vi.fn() },
    });

    expect((await screen.findByRole('alert')).textContent).toContain('Library unavailable.');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('does not represent an inactive member as the active folder', async () => {
    renderLibrary({
      folderPicker: { chooseFolder: vi.fn() },
      api: {
        load: vi.fn(async () => ({
          ...emptyLibrary,
          members: [
            { favorite: false, openedAt: '2026-08-31T12:00:00.000Z', path: '/library/notes' },
          ],
        })),
        openFolder: vi.fn(),
      },
    });
    await waitFor(() => expect(screen.queryByRole('button')).toBeNull());
  });

  it('lists every member from the scoped query and selects another folder', async () => {
    const activeLibrary: LibrarySnapshot = {
      ...emptyLibrary,
      activeFolder: { name: 'Research', path: '/library/research' },
      members: [
        { favorite: false, openedAt: '2026-08-31T12:00:00.000Z', path: '/library/research' },
        { favorite: false, openedAt: '2026-08-30T12:00:00.000Z', path: '/library/notes' },
      ],
    };
    const selectedLibrary: LibrarySnapshot = {
      ...activeLibrary,
      activeFolder: { name: 'notes', path: '/library/notes' },
    };
    const openFolder = vi.fn(async () => selectedLibrary);
    renderLibrary({
      folderPicker: { chooseFolder: vi.fn() },
      api: { load: vi.fn(async () => activeLibrary), openFolder },
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Research' }));

    expect(await screen.findByTitle('~/research')).not.toBeNull();
    await user.click(screen.getByTitle('~/notes'));

    expect(openFolder).toHaveBeenCalledWith('/library/notes', expect.any(AbortSignal));
    expect(await screen.findByRole('button', { name: 'notes' })).not.toBeNull();
  });

  it('adds a subsequent folder from the active-folder chooser', async () => {
    const activeLibrary: LibrarySnapshot = {
      ...emptyLibrary,
      activeFolder: { name: 'Research', path: '/library/research' },
      members: [
        { favorite: false, openedAt: '2026-08-31T12:00:00.000Z', path: '/library/research' },
      ],
    };
    const addedLibrary: LibrarySnapshot = {
      ...activeLibrary,
      activeFolder: { name: 'Writing', path: '/library/writing' },
      members: [
        { favorite: false, openedAt: '2026-08-31T12:05:00.000Z', path: '/library/writing' },
        ...activeLibrary.members,
      ],
    };
    const chooseFolder = vi.fn(async () => ({
      status: 'selected' as const,
      folderPath: '/library/writing',
    }));
    const openFolder = vi.fn(async () => addedLibrary);
    renderLibrary({
      folderPicker: { chooseFolder },
      api: { load: vi.fn(async () => activeLibrary), openFolder },
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Research' }));
    await user.click(await screen.findByRole('menuitem', { hidden: true, name: 'Open folder' }));

    expect(chooseFolder).toHaveBeenCalledWith(undefined);
    expect(openFolder).toHaveBeenCalledWith('/library/writing', expect.any(AbortSignal));
    expect(await screen.findByRole('button', { name: 'Writing' })).not.toBeNull();
  });
});
