import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { FilesApi } from '@/features/workspace/application/ports';
import {
  createWorkspaceRuntime,
  type WorkspaceRuntime,
} from '@/features/workspace/application/runtime';
import type { WorkspaceListing } from '@/features/workspace/domain/tree';

import { FileTree } from './file-tree';

const listing: WorkspaceListing = {
  files: [
    {
      availability: 'available',
      format: 'md',
      heading: 'Plan',
      importedAt: '',
      kind: 'regular',
      path: 'docs/plan.md',
      size: 42,
      snippet: '',
    },
    {
      availability: 'available',
      format: 'generic',
      heading: '',
      importedAt: '',
      kind: 'regular',
      path: 'archive.zip',
      size: 7,
      snippet: '',
    },
    {
      availability: 'available',
      format: 'generic',
      heading: '',
      importedAt: '',
      kind: 'symlink',
      path: 'linked-file',
      size: 0,
      snippet: '',
    },
  ],
  folderName: 'Research',
  folders: [
    { kind: 'normal', path: 'docs' },
    { kind: 'excluded', path: 'vendor' },
  ],
};

const runtimes: WorkspaceRuntime[] = [];

function renderTree(
  api: FilesApi,
  onOpenSource?: ComponentProps<typeof FileTree>['onOpenSource'],
  extra: Partial<
    Pick<ComponentProps<typeof FileTree>, 'onReprocess' | 'retireSources' | 'rowMarkers'>
  > = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const runtime = createWorkspaceRuntime({
    folder: { name: 'Research', path: '/library/research' },
    generation: runtimes.length + 1,
    queries: {
      cancel: () => queryClient.cancelQueries(),
      remove: () => queryClient.removeQueries(),
    },
  });
  runtimes.push(runtime);
  return render(
    <QueryClientProvider client={queryClient}>
      <FileTree
        {...extra}
        api={api}
        onOpenSource={onOpenSource}
        revealLabel="Show in file manager"
        runtime={runtime}
      />
    </QueryClientProvider>,
  );
}

function filesApi(value: WorkspaceListing = listing): FilesApi {
  return {
    createEntry: vi.fn(async (_folder, _kind, parentPath, name) => ({
      path: parentPath ? `${parentPath}/${name}` : name,
    })),
    deleteEntry: vi.fn(async () => undefined),
    load: vi.fn(async () => value),
    renameEntry: vi.fn(async (_folder, entry, name) => ({
      path: entry.path.replace(/[^/]+$/u, name),
    })),
    reveal: vi.fn(async () => undefined),
  };
}

afterEach(() => {
  cleanup();
  for (const runtime of runtimes.splice(0)) runtime.dispose();
});

describe('file tree', () => {
  it('renders one semantic visible-row model and omits collapsed descendants', async () => {
    const api = filesApi();
    renderTree(api);

    const tree = await screen.findByRole('tree', { name: 'Files' });
    expect(api.load).toHaveBeenCalledWith('/library/research', expect.any(AbortSignal));
    expect(tree.tabIndex).toBe(-1);
    expect(screen.queryByRole('treeitem', { name: 'plan.md' })).toBeNull();
    const rows = screen.getAllByRole('treeitem');
    expect(rows.filter((row) => row.tabIndex === 0)).toHaveLength(1);

    const docs = screen.getByRole('treeitem', { name: 'docs' });
    expect(docs.getAttribute('aria-level')).toBe('1');
    expect(docs.getAttribute('data-proximity-index')).toBe('0');
    expect(docs.style.paddingLeft).toBe('8px');
    await userEvent.setup().click(docs);

    const plan = await screen.findByRole('treeitem', { name: 'plan.md' });
    expect(plan.getAttribute('aria-level')).toBe('2');
    expect(plan.getAttribute('aria-posinset')).toBe('1');
    expect(plan.getAttribute('data-proximity-index')).toBe('1');
    expect(plan.style.getPropertyValue('--hover')).toBe('transparent');
    expect(docs.style.getPropertyValue('--hover')).toBe('');
    expect(plan.style.paddingLeft).toBe('34px');
    expect(plan.parentElement?.querySelectorAll('[data-tree-rail]')).toHaveLength(1);
    expect(tree.contains(plan)).toBe(true);
  });

  it('uses arrows, Home, and End over the same rendered order', async () => {
    renderTree(filesApi());
    const user = userEvent.setup();
    const docs = await screen.findByRole('treeitem', { name: 'docs' });
    docs.focus();

    await user.keyboard('{ArrowRight}');
    const plan = await screen.findByRole('treeitem', { name: 'plan.md' });
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(docs.ownerDocument.activeElement).toBe(plan));

    await user.keyboard('{ArrowLeft}');
    await waitFor(() => expect(docs.ownerDocument.activeElement).toBe(docs));
    await user.keyboard('{End}');
    expect(docs.ownerDocument.activeElement).toBe(
      screen.getByRole('treeitem', { name: /linked-file/ }),
    );
    await user.keyboard('{Home}');
    expect(docs.ownerDocument.activeElement).toBe(docs);
  });

  it('explains generic files and reveals restricted entries without expanding them', async () => {
    const api = filesApi();
    renderTree(api);
    const user = userEvent.setup();

    expect(
      await screen.findByRole('treeitem', {
        name: 'archive.zip, excluded from Search and automatic Chat context',
      }),
    ).not.toBeNull();
    const restrictedFolder = screen.getByRole('treeitem', {
      name: 'vendor, restricted, Show in file manager',
    });
    expect(restrictedFolder.hasAttribute('aria-expanded')).toBe(false);
    expect(restrictedFolder.title).toBe('Show in file manager');
    await user.click(restrictedFolder);

    expect(api.reveal).toHaveBeenCalledWith('/library/research', 'vendor', expect.any(AbortSignal));
    await user.click(
      screen.getByRole('treeitem', {
        name: 'linked-file, restricted, Show in file manager',
      }),
    );
    expect(api.reveal).toHaveBeenCalledWith(
      '/library/research',
      'linked-file',
      expect.any(AbortSignal),
    );
  });

  it('emits explicit source identity for regular files and keeps restricted files reveal-only', async () => {
    const api = filesApi();
    const onOpenSource = vi.fn();
    renderTree(api, onOpenSource);
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole('treeitem', {
        name: 'archive.zip, excluded from Search and automatic Chat context',
      }),
    );
    expect(onOpenSource).toHaveBeenCalledWith({
      folderPath: '/library/research',
      path: 'archive.zip',
    });

    await user.click(
      screen.getByRole('treeitem', {
        name: 'linked-file, restricted, Show in file manager',
      }),
    );
    expect(onOpenSource).toHaveBeenCalledOnce();
    expect(api.reveal).toHaveBeenCalledWith(
      '/library/research',
      'linked-file',
      expect.any(AbortSignal),
    );
  });

  it('marks rows that need attention and offers Reprocess from the context menu', async () => {
    const api = filesApi({
      ...listing,
      files: [
        ...listing.files,
        {
          availability: 'available',
          format: 'pdf',
          heading: '',
          importedAt: '',
          kind: 'regular',
          path: 'paper.pdf',
          size: 9,
          snippet: '',
        },
        {
          availability: 'available',
          format: 'audio',
          heading: '',
          importedAt: '',
          kind: 'regular',
          path: 'talk.mp3',
          size: 9,
          snippet: '',
        },
      ],
    });
    const onReprocess = vi.fn();
    renderTree(api, undefined, {
      onReprocess,
      rowMarkers: {
        'paper.pdf': { kind: 'failed', title: 'File preparation failed.' },
        'talk.mp3': { kind: 'blocked', title: 'Transcription setup is required.' },
      },
    });

    const failed = await screen.findByRole('treeitem', {
      name: 'paper.pdf, File preparation failed.',
    });
    expect(failed.getAttribute('title')).toBe('File preparation failed.');
    expect(failed.querySelector('svg.lucide-triangle-alert')).not.toBeNull();
    const blocked = screen.getByRole('treeitem', {
      name: 'talk.mp3, Transcription setup is required.',
    });
    expect(blocked.querySelector('svg.lucide-circle-alert')).not.toBeNull();
    expect(screen.getByRole('treeitem', { name: 'docs' }).getAttribute('title')).toBe('docs');

    fireEvent.contextMenu(failed, { clientX: 12, clientY: 12 });
    await userEvent.setup().click(await screen.findByRole('menuitem', { name: 'Reprocess' }));
    expect(onReprocess).toHaveBeenCalledWith({
      folderPath: '/library/research',
      path: 'paper.pdf',
    });

    fireEvent.contextMenu(blocked, { clientX: 12, clientY: 12 });
    expect(screen.queryByRole('menuitem', { name: 'Reprocess' })).toBeNull();
  });

  it('keeps initial rendering bounded and progressively reveals more rows', async () => {
    const manyFiles: WorkspaceListing = {
      files: Array.from({ length: 250 }, (_, index) => ({
        availability: 'available',
        format: 'txt',
        heading: '',
        importedAt: '',
        kind: 'regular',
        path: `file-${String(index).padStart(3, '0')}.txt`,
        size: index,
        snippet: '',
      })),
      folderName: 'Large',
      folders: [],
    };
    renderTree(filesApi(manyFiles));

    await screen.findByRole('tree');
    expect(screen.getAllByRole('treeitem')).toHaveLength(240);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Show 10 more' }));
    expect(screen.getAllByRole('treeitem')).toHaveLength(250);
  });

  it('keeps listing failure and retry local to Files', async () => {
    const load = vi
      .fn<FilesApi['load']>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(listing);
    renderTree({ ...filesApi(), load });

    expect((await screen.findByRole('alert')).textContent).toBe('Files unavailable.');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('tree', { name: 'Files' })).not.toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('file tree drag source', () => {
  it('offers regular files as a source drag and never generic or restricted entries', async () => {
    const { SOURCE_DRAG_MIME } = await import('@/shared/utils/source-drag');
    renderTree(filesApi(), vi.fn());
    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: 'none',
      setData: (type: string, value: string) => void data.set(type, value),
    };
    await userEvent.setup().click(await screen.findByRole('treeitem', { name: 'docs' }));
    const regular = await screen.findByRole('treeitem', { name: 'plan.md' });
    expect(regular.getAttribute('draggable')).toBe('true');
    fireEvent.dragStart(regular, { dataTransfer });
    expect(JSON.parse(data.get(SOURCE_DRAG_MIME) ?? 'null')).toEqual({
      folderPath: '/library/research',
      path: 'docs/plan.md',
    });

    const generic = screen.getByRole('treeitem', {
      name: 'archive.zip, excluded from Search and automatic Chat context',
    });
    expect(generic.getAttribute('draggable')).toBe('false');
    const restricted = screen.getByRole('treeitem', {
      name: 'linked-file, restricted, Show in file manager',
    });
    expect(restricted.getAttribute('draggable')).toBe('false');
  });
});

describe('file tree entry operations', () => {
  it('names a new file from the tree space and a new folder from a folder row', async () => {
    const api = filesApi();
    const onOpenSource = vi.fn();
    renderTree(api, onOpenSource);
    const user = userEvent.setup();

    const tree = await screen.findByRole('tree', { name: 'Files' });
    fireEvent.contextMenu(tree, { clientX: 40, clientY: 200 });
    await user.click(await screen.findByRole('menuitem', { name: 'New file' }));
    const draft = await screen.findByRole('textbox', { name: 'New file in folder root' });
    expect(draft.matches(':focus')).toBe(true);
    await user.keyboard('a/b{Enter}');
    expect(screen.getByRole('alert').textContent).toBe('A name cannot contain slashes.');
    expect(api.createEntry).not.toHaveBeenCalled();
    await user.clear(draft);
    await user.keyboard('Plan{Enter}');
    await waitFor(() =>
      expect(api.createEntry).toHaveBeenCalledWith(
        '/library/research',
        'file',
        '',
        'Plan',
        expect.any(AbortSignal),
      ),
    );
    await waitFor(() =>
      expect(onOpenSource).toHaveBeenCalledWith({ folderPath: '/library/research', path: 'Plan' }),
    );
    expect(screen.queryByRole('textbox')).toBeNull();

    fireEvent.contextMenu(screen.getByRole('treeitem', { name: 'docs' }), {
      clientX: 12,
      clientY: 12,
    });
    await user.click(await screen.findByRole('menuitem', { name: 'New folder' }));
    const folderDraft = await screen.findByRole('textbox', { name: 'New folder in docs' });
    expect(folderDraft.closest('[role="treeitem"]')?.getAttribute('aria-level')).toBe('2');
    expect(screen.getByRole('treeitem', { name: 'docs' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    await user.keyboard('archive{Enter}');
    await waitFor(() =>
      expect(api.createEntry).toHaveBeenLastCalledWith(
        '/library/research',
        'folder',
        'docs',
        'archive',
        expect.any(AbortSignal),
      ),
    );

    fireEvent.contextMenu(tree, { clientX: 40, clientY: 200 });
    await user.click(await screen.findByRole('menuitem', { name: 'New folder' }));
    await screen.findByRole('textbox', { name: 'New folder in folder root' });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(api.createEntry).toHaveBeenCalledTimes(2);
  });

  it('renames from F2 with the stem selected and from a double click, retiring open documents first', async () => {
    const api = filesApi();
    const onOpenSource = vi.fn();
    const retireSources = vi.fn(async () => [
      { folderPath: '/library/research', path: 'docs/plan.md' },
    ]);
    renderTree(api, onOpenSource, { retireSources });
    const user = userEvent.setup();

    const docs = await screen.findByRole('treeitem', { name: 'docs' });
    docs.focus();
    await user.keyboard('{Enter}');
    const plan = await screen.findByRole('treeitem', { name: 'plan.md' });
    plan.focus();
    await user.keyboard('{F2}');
    const field = await screen.findByRole<HTMLInputElement>('textbox', { name: 'Rename plan.md' });
    expect(field.value).toBe('plan.md');
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 4]);
    await user.keyboard('outline{Enter}');
    await waitFor(() =>
      expect(api.renameEntry).toHaveBeenCalledWith(
        '/library/research',
        { kind: 'file', path: 'docs/plan.md' },
        'outline.md',
        expect.any(AbortSignal),
      ),
    );
    expect(retireSources).toHaveBeenCalledWith({ kind: 'file', path: 'docs/plan.md' });
    await waitFor(() =>
      expect(onOpenSource).toHaveBeenCalledWith({
        folderPath: '/library/research',
        path: 'docs/outline.md',
      }),
    );

    fireEvent.doubleClick(screen.getByRole('treeitem', { name: 'docs' }));
    const folderField = await screen.findByRole<HTMLInputElement>('textbox', {
      name: 'Rename docs',
    });
    expect(folderField.value).toBe('docs');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(api.renameEntry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('treeitem', { name: 'docs' }).matches(':focus')).toBe(true);
  });

  it('deletes only after confirmation and keeps the entry when a document cannot be saved', async () => {
    const api = filesApi();
    const retireSources = vi
      .fn<NonNullable<ComponentProps<typeof FileTree>['retireSources']>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([]);
    renderTree(api, undefined, { retireSources });
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
        '/library/research',
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
    const api = filesApi();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const runtime = createWorkspaceRuntime({
      folder: { name: 'Research', path: '/library/research' },
      generation: runtimes.length + 1,
      queries: {
        cancel: () => queryClient.cancelQueries(),
        remove: () => queryClient.removeQueries(),
      },
    });
    runtimes.push(runtime);
    render(
      <QueryClientProvider client={queryClient}>
        <div data-sidebar="sidebar" data-testid="frame">
          <div data-slot="scroll-area-viewport">
            <FileTree api={api} revealLabel="Show in file manager" runtime={runtime} />
          </div>
          <div data-sidebar="footer">
            <button type="button">Settings</button>
          </div>
        </div>
      </QueryClientProvider>,
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
    renderTree(filesApi());
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
