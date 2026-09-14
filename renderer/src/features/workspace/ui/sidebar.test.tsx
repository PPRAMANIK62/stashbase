import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { ProjectRegistryPort } from '@/features/workspace/application/ports';
import { projectApi, projectRegistrySnapshot, pendingProjectApi } from '@/test/fakes/workspace';
import { withQueryClient } from '@/test/query';

import { ProjectSidebar, type ProjectSidebarProps } from './sidebar';

const emptyProject = projectRegistrySnapshot({
  activeFolder: null,
  homeDirectory: '/project',
  projects: [],
});

const RESEARCH = { name: 'Research', path: '/project/research' };
const researchMember = {
  favorite: false,
  openedAt: '2026-08-31T12:00:00.000Z',
  path: RESEARCH.path,
};
const activeProject = projectRegistrySnapshot({
  ...emptyProject,
  activeFolder: RESEARCH,
  projects: [researchMember],
});

type SidebarTestProps = Omit<ProjectSidebarProps, 'api' | 'contentId' | 'onOpenChange' | 'open'> &
  Partial<Pick<ProjectSidebarProps, 'contentId' | 'onOpenChange' | 'open'>> & {
    api: Partial<ProjectRegistryPort>;
  };

function renderProject({ api, ...props }: SidebarTestProps) {
  return withQueryClient(
    <ProjectSidebar
      contentId="folder-content"
      onOpenChange={vi.fn()}
      open
      {...props}
      api={projectApi(api)}
    />,
  );
}

afterEach(cleanup);

describe('project sidebar', () => {
  it('does not claim the project is empty before membership resolves', () => {
    renderProject({ api: pendingProjectApi() });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the active folder as a section header that folds, with no way to switch folders', async () => {
    const onOpenChange = vi.fn();
    renderProject({ api: { load: vi.fn(async () => activeProject) }, onOpenChange });

    const header = await screen.findByRole('button', { name: 'Research' });
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(header.getAttribute('aria-controls')).toBe('folder-content');
    expect(header.getAttribute('aria-current')).toBeNull();
    await userEvent.setup().click(header);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // A window keeps its folder; another folder is another window.
    expect(screen.queryByRole('button', { name: 'Switch folder' })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('offers New file and New folder on the header when the window can make them', async () => {
    const onNewFile = vi.fn();
    const onNewFolder = vi.fn();
    renderProject({ api: { load: vi.fn(async () => activeProject) }, onNewFile, onNewFolder });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'New file' }));
    expect(onNewFile).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'New folder' }));
    expect(onNewFolder).toHaveBeenCalledOnce();
  });

  it('is the name alone, with no fold and no creates, while not foldable', async () => {
    renderProject({
      api: { load: vi.fn(async () => activeProject) },
      foldable: false,
      onNewFile: vi.fn(),
      onNewFolder: vi.fn(),
    });

    expect(await screen.findByText('Research')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Research' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New file' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New folder' })).toBeNull();
  });

  it('offers Collapse all beside the creates when the tree is showing', async () => {
    const onCollapseAll = vi.fn();
    renderProject({
      api: { load: vi.fn(async () => activeProject) },
      onCollapseAll,
      onNewFile: vi.fn(),
      onNewFolder: vi.fn(),
    });

    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Collapse all folders' }));
    expect(onCollapseAll).toHaveBeenCalledOnce();
  });

  it('offers no creates on the header without a window to make them in', async () => {
    renderProject({ api: { load: vi.fn(async () => activeProject) } });

    await screen.findByRole('button', { name: 'Research' });
    expect(screen.queryByRole('button', { name: 'New file' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New folder' })).toBeNull();
  });

  it('exposes local retry after membership failure', async () => {
    const load = vi
      .fn<ProjectRegistryPort['load']>()
      .mockRejectedValueOnce(new Error('server offline'))
      .mockResolvedValue(emptyProject);
    renderProject({ api: { load } });

    // Unreachable projects are a lost capability, said quietly.
    expect((await screen.findByRole('status')).textContent).toContain('Projects unavailable.');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it('does not represent an inactive member as the active folder', async () => {
    renderProject({
      api: {
        load: vi.fn(async () =>
          projectRegistrySnapshot({
            ...emptyProject,
            projects: [{ ...researchMember, path: '/project/notes' }],
          }),
        ),
      },
    });
    await waitFor(() => expect(screen.queryByRole('button')).toBeNull());
  });
});
