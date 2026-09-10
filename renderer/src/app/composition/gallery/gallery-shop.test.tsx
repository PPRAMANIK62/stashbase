/**
 * J13 at the renderer composition boundary: both ways into the shop, the entry
 * page a card opens, and the copy that reaches the Library through the ordinary
 * import and a window of its own.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { Providers } from '@/app/providers';
import { App } from '@/app/shell';
import type { GalleryEntry } from '@/features/gallery/public';
import { appDependencies, galleryPort } from '@/test/fakes/app';
import { libraryApi, librarySnapshot, workspaceAdapters } from '@/test/fakes/workspace';

afterEach(cleanup);

const PUBLISHED: GalleryEntry = {
  category: 'reference',
  contents: 'Two pages',
  description: 'Everything about widgets.',
  files: ['README.md', 'wiki/index.md'],
  id: 'widgets',
  learnMore: null,
  name: 'Widget Handbook',
  repo: 'https://github.com/owner/widgets',
  screenshots: null,
  starterPrompts: [],
  wikiPrompt: 'Build wiki pages from these notes.',
};

function harness({ folderOpen }: { folderOpen: boolean }) {
  const copy = vi.fn(async () => '/library/Widget Handbook');
  const snapshot = librarySnapshot();
  const dependencies = appDependencies({
    gallery: galleryPort({ copy, loadIndex: vi.fn(async () => [PUBLISHED]) }),
    workspace: {
      adapters: workspaceAdapters({
        library: libraryApi({
          load: vi.fn(async () => ({
            ...snapshot,
            activeFolder: folderOpen ? snapshot.activeFolder : null,
          })),
        }),
      }),
      revealLabel: 'Show in file manager',
    },
  });
  dependencies.library.api = dependencies.workspace.adapters.library;
  render(
    <Providers>
      <App dependencies={dependencies} />
    </Providers>,
  );
  return { copy };
}

describe('Gallery shop', () => {
  it('bands the shelf onto the welcome screen and opens the entry a card names', async () => {
    harness({ folderOpen: false });

    // Browsing needs no folder, no account, and no Agent runtime. The band is
    // derived rather than offered, so the entry is on the screen before any
    // click. The click is retried against a fresh node: the welcome screen
    // re-renders as its library query settles, and a node found before that is
    // already detached.
    await screen.findByRole('button', { name: /Widget Handbook/u });
    expect(screen.queryByRole('dialog', { name: 'Gallery' })).toBeNull();
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /Widget Handbook/u }));
      expect(
        within(screen.getByRole('dialog', { name: 'Gallery' })).getByRole('heading', {
          name: 'Widget Handbook',
        }),
      ).not.toBeNull();
    });
  });

  it('opens over a folder window from the sidebar and copies an entry', async () => {
    const { copy } = harness({ folderOpen: true });
    const user = userEvent.setup();

    fireEvent.click(await screen.findByRole('button', { name: 'Gallery' }));
    await user.click(await screen.findByRole('button', { name: /Widget Handbook/u }));

    // The entry page states what is inside and how it was built before asking
    // for the copy.
    const page = await screen.findByRole('dialog', { name: 'Gallery' });
    expect(within(page).getByRole('heading', { name: 'Widget Handbook' })).not.toBeNull();
    // What's inside is the copy's own tree, so a nested path reads as a folder
    // holding a file rather than as one long line.
    expect(within(page).getByRole('button', { name: 'wiki' })).not.toBeNull();
    expect(within(page).getByText('index.md')).not.toBeNull();
    expect(within(page).getByText('README.md')).not.toBeNull();
    // Both artifacts stand at once: neither is long enough to be worth a
    // click, and the request is what teaches a reader what to ask for.
    expect(within(page).getByRole('heading', { name: "How it's built" })).not.toBeNull();
    expect(within(page).getByText('Build wiki pages from these notes.')).not.toBeNull();

    await user.click(within(page).getByRole('button', { name: 'Make a copy' }));
    await waitFor(() =>
      expect(copy).toHaveBeenCalledWith(
        { name: 'Widget Handbook', repo: 'https://github.com/owner/widgets' },
        expect.anything(),
      ),
    );
    // The shop stays put for the next entry: a copy opens a window of its own.
    expect(screen.queryByRole('dialog', { name: 'Gallery' })).not.toBeNull();
    await user.click(within(page).getByRole('button', { name: 'All Wikis' }));
    expect(await screen.findByRole('button', { name: /Widget Handbook/u })).not.toBeNull();
  });
});
