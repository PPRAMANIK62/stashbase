import type { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { FilesPort } from '@/features/workspace/application/ports';
import {
  createWorkspaceRuntime,
  type WorkspaceRuntime,
} from '@/features/workspace/application/runtime';
import {
  filesApi,
  listing,
  listingFile,
  listingFolder,
  RESEARCH_FOLDER,
  workspaceRuntimeOptions,
} from '@/test/fakes/workspace';
import { createTestQueryClient, withQueryClient } from '@/test/query';

import { FileTree } from './file-tree';

const RESEARCH_LISTING = listing(
  [
    listingFile({ heading: 'Plan', path: 'docs/plan.md', size: 42 }),
    listingFile({ format: 'generic', path: 'archive.zip', size: 7 }),
    listingFile({ format: 'generic', kind: 'symlink', path: 'linked-file', size: 0 }),
  ],
  ['docs', listingFolder({ kind: 'excluded', path: 'vendor' })],
);

const runtimes: WorkspaceRuntime[] = [];

/** One runtime per rendered tree, bound to the client the tree reads through
 *  so disposal cancels exactly those queries. */
function treeRuntime(client: QueryClient): WorkspaceRuntime {
  const runtime = createWorkspaceRuntime(
    workspaceRuntimeOptions({
      generation: runtimes.length + 1,
      queries: {
        cancel: () => client.cancelQueries(),
        remove: () => client.removeQueries(),
      },
    }),
  );
  runtimes.push(runtime);
  return runtime;
}

function renderTree(
  api: FilesPort,
  retireSources?: ComponentProps<typeof FileTree>['retireSources'],
) {
  const client = createTestQueryClient();
  return withQueryClient(
    <FileTree
      api={api}
      retireSources={retireSources}
      revealLabel="Show in file manager"
      runtime={treeRuntime(client)}
    />,
    client,
  );
}

function treeApi(): FilesPort {
  return filesApi({ load: vi.fn(async () => RESEARCH_LISTING) });
}

afterEach(() => {
  cleanup();
  for (const runtime of runtimes.splice(0)) runtime.dispose();
});

describe('file tree menu', () => {
  it('deletes only after confirmation and keeps the entry when a document cannot be saved', async () => {
    const api = treeApi();
    const retireSources = vi
      .fn<NonNullable<ComponentProps<typeof FileTree>['retireSources']>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([]);
    renderTree(api, retireSources);
    const user = userEvent.setup();

    const archive = await screen.findByRole('treeitem', {
      name: 'archive.zip, excluded from Search and automatic Chat context',
    });
    fireEvent.contextMenu(archive, { clientX: 12, clientY: 12 });
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete file?' });
    expect(dialog.textContent).toContain('archive.zip');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'An open document could not be saved, so nothing was changed.',
    );
    expect(api.deleteEntry).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(api.deleteEntry).toHaveBeenCalledWith(
        RESEARCH_FOLDER.path,
        { kind: 'file', path: 'archive.zip' },
        expect.any(AbortSignal),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    const docs = screen.getByRole('treeitem', { name: 'docs' });
    docs.focus();
    await user.keyboard('{Delete}');
    expect(await screen.findByRole('dialog', { name: 'Delete folder?' })).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.deleteEntry).toHaveBeenCalledTimes(1);
  });

  it('opens the tree menu from the empty scroll space below the rows', async () => {
    const api = treeApi();
    const client = createTestQueryClient();
    withQueryClient(
      <div data-sidebar="sidebar" data-testid="frame">
        <div data-slot="scroll-area-viewport">
          <FileTree api={api} revealLabel="Show in file manager" runtime={treeRuntime(client)} />
        </div>
        <div data-sidebar="footer">
          <button type="button">Settings</button>
        </div>
      </div>,
      client,
    );
    await screen.findByRole('tree', { name: 'Files' });

    fireEvent.contextMenu(screen.getByTestId('frame'), { clientX: 30, clientY: 400 });
    expect(await screen.findByRole('menuitem', { name: 'New file' })).not.toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBeNull();
    await userEvent.setup().keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'New file' })).toBeNull());

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Settings' }), {
      clientX: 30,
      clientY: 800,
    });
    expect(screen.queryByRole('menuitem', { name: 'New file' })).toBeNull();
  });

  it('offers restricted entries only the reveal action', async () => {
    renderTree(treeApi());
    const user = userEvent.setup();

    const vendor = await screen.findByRole('treeitem', {
      name: 'vendor, restricted, Show in file manager',
    });
    fireEvent.contextMenu(vendor, { clientX: 12, clientY: 12 });
    expect(await screen.findByRole('menuitem', { name: 'Show in file manager' })).not.toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'New file' })).toBeNull();
    await user.keyboard('{Escape}');
    fireEvent.doubleClick(vendor);
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
