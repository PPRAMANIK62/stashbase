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
import type { WorkspaceListing } from '@/features/workspace/domain/tree';
import { expectFocused } from '@/test/dom';
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

const PLAN = listingFile({ heading: 'Plan', path: 'docs/plan.md', size: 42 });
const ARCHIVE = listingFile({ format: 'generic', path: 'archive.zip', size: 7 });
const LINKED = listingFile({ format: 'generic', kind: 'symlink', path: 'linked-file', size: 0 });
const RESEARCH_LISTING = listing(
  [PLAN, ARCHIVE, LINKED],
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
  onOpenSource?: ComponentProps<typeof FileTree>['onOpenSource'],
  extra: Partial<Pick<ComponentProps<typeof FileTree>, 'onReprocess' | 'rowMarkers'>> = {},
) {
  const client = createTestQueryClient();
  return withQueryClient(
    <FileTree
      {...extra}
      api={api}
      onOpenSource={onOpenSource}
      revealLabel="Show in file manager"
      runtime={treeRuntime(client)}
    />,
    client,
  );
}

function treeApi(value: WorkspaceListing = RESEARCH_LISTING): FilesPort {
  return filesApi({ load: vi.fn(async () => value) });
}

afterEach(() => {
  cleanup();
  for (const runtime of runtimes.splice(0)) runtime.dispose();
});

describe('file tree', () => {
  it('renders one semantic visible-row model and omits collapsed descendants', async () => {
    const api = treeApi();
    renderTree(api);

    const tree = await screen.findByRole('tree', { name: 'Files' });
    expect(api.load).toHaveBeenCalledWith(RESEARCH_FOLDER.path, expect.any(AbortSignal));
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
    // `data-tree-rail` marks purely decorative aria-hidden guides with no role or label of their
    // own, so the depth-based rail count can only be read back from the row wrapper's DOM shape.
    expect(plan.parentElement?.querySelectorAll('[data-tree-rail]')).toHaveLength(1); // dom-contract: see comment above
    expect(tree.contains(plan)).toBe(true);
  });

  it('uses arrows, Home, and End over the same rendered order', async () => {
    renderTree(treeApi());
    const user = userEvent.setup();
    const docs = await screen.findByRole('treeitem', { name: 'docs' });
    docs.focus();

    await user.keyboard('{ArrowRight}');
    const plan = await screen.findByRole('treeitem', { name: 'plan.md' });
    await user.keyboard('{ArrowRight}');
    await waitFor(() => {
      expectFocused(plan);
    });

    await user.keyboard('{ArrowLeft}');
    await waitFor(() => {
      expectFocused(docs);
    });
    await user.keyboard('{End}');
    expectFocused(screen.getByRole('treeitem', { name: /linked-file/ }));
    await user.keyboard('{Home}');
    expectFocused(docs);
  });

  it('explains generic files and reveals restricted entries without expanding them', async () => {
    const api = treeApi();
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

    expect(api.reveal).toHaveBeenCalledWith(
      RESEARCH_FOLDER.path,
      'vendor',
      expect.any(AbortSignal),
    );
    await user.click(
      screen.getByRole('treeitem', {
        name: 'linked-file, restricted, Show in file manager',
      }),
    );
    expect(api.reveal).toHaveBeenCalledWith(
      RESEARCH_FOLDER.path,
      'linked-file',
      expect.any(AbortSignal),
    );
  });

  it('emits explicit source identity for regular files and keeps restricted files reveal-only', async () => {
    const api = treeApi();
    const onOpenSource = vi.fn();
    renderTree(api, onOpenSource);
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole('treeitem', {
        name: 'archive.zip, excluded from Search and automatic Chat context',
      }),
    );
    expect(onOpenSource).toHaveBeenCalledWith({
      folderPath: RESEARCH_FOLDER.path,
      path: 'archive.zip',
    });

    await user.click(
      screen.getByRole('treeitem', {
        name: 'linked-file, restricted, Show in file manager',
      }),
    );
    expect(onOpenSource).toHaveBeenCalledOnce();
    expect(api.reveal).toHaveBeenCalledWith(
      RESEARCH_FOLDER.path,
      'linked-file',
      expect.any(AbortSignal),
    );
  });

  it('marks rows that need attention and offers Reprocess from the context menu', async () => {
    const api = treeApi({
      ...RESEARCH_LISTING,
      files: [
        ...RESEARCH_LISTING.files,
        listingFile({ format: 'pdf', path: 'paper.pdf', size: 9 }),
        listingFile({ format: 'audio', path: 'talk.mp3', size: 9 }),
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
    // The marker icon is aria-hidden and picked from a kind→icon map with no other observable
    // signal, so which lucide icon rendered is only readable from its own generated class name.
    expect(failed.querySelector('svg.lucide-triangle-alert')).not.toBeNull(); // dom-contract: see comment above
    const blocked = screen.getByRole('treeitem', {
      name: 'talk.mp3, Transcription setup is required.',
    });
    expect(blocked.querySelector('svg.lucide-circle-alert')).not.toBeNull(); // dom-contract: see comment above
    expect(screen.getByRole('treeitem', { name: 'docs' }).getAttribute('title')).toBe('docs');

    fireEvent.contextMenu(failed, { clientX: 12, clientY: 12 });
    await userEvent.setup().click(await screen.findByRole('menuitem', { name: 'Reprocess' }));
    expect(onReprocess).toHaveBeenCalledWith({
      folderPath: RESEARCH_FOLDER.path,
      path: 'paper.pdf',
    });

    fireEvent.contextMenu(blocked, { clientX: 12, clientY: 12 });
    expect(screen.queryByRole('menuitem', { name: 'Reprocess' })).toBeNull();
  });

  it('keeps initial rendering bounded and progressively reveals more rows', async () => {
    const manyFiles = listing(
      Array.from({ length: 250 }, (_, index) =>
        listingFile({
          format: 'txt',
          path: `file-${String(index).padStart(3, '0')}.txt`,
          size: index,
        }),
      ),
      [],
      'Large',
    );
    renderTree(treeApi(manyFiles));

    await screen.findByRole('tree');
    expect(screen.getAllByRole('treeitem')).toHaveLength(240);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Show 10 more' }));
    expect(screen.getAllByRole('treeitem')).toHaveLength(250);
  });

  it('keeps listing failure and retry local to Files', async () => {
    const load = vi
      .fn<FilesPort['load']>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(RESEARCH_LISTING);
    renderTree(filesApi({ load }));

    expect((await screen.findByRole('alert')).textContent).toBe('StashBase is unavailable.');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('tree', { name: 'Files' })).not.toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('file tree drag source', () => {
  it('offers regular files as a source drag and never generic or restricted entries', async () => {
    const { SOURCE_DRAG_MIME } = await import('@/shared/utils/source-drag');
    renderTree(treeApi(), vi.fn());
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
      folderPath: RESEARCH_FOLDER.path,
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
