import { waitFor, within } from '@testing-library/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { AppDependencies } from '@/app/dependencies';
import { Providers } from '@/app/providers';
import { App } from '@/app/shell';
import { appDependencies } from '@/test/fakes/app';
import { documentAdapters, sourceApi } from '@/test/fakes/documents';
import { preparationStatusApi } from '@/test/fakes/preparation';
import {
  filesApi,
  libraryApi,
  librarySnapshot,
  listing,
  listingFile,
  pendingLibraryApi,
  sessionPersistence,
  workspaceAdapters,
} from '@/test/fakes/workspace';

/** The shell before any folder is authorized: the library never settles, so
 *  nothing downstream of an active folder can render. */
function restoringDependencies(): AppDependencies {
  const base = appDependencies();
  return {
    ...base,
    documents: { ...base.documents, adapters: documentAdapters({ source: sourceApi() }) },
    library: { ...base.library, api: pendingLibraryApi() },
    preparation: {
      ...base.preparation,
      statusApi: preparationStatusApi({ load: vi.fn(() => new Promise<never>(() => undefined)) }),
    },
  };
}

describe('workspace shell', () => {
  let container: HTMLDivElement;
  let root: Root;
  let dependencies: AppDependencies;

  async function mount(next: AppDependencies) {
    root = createRoot(container);
    await act(async () => {
      root.render(
        <Providers>
          <App dependencies={next} />
        </Providers>,
      );
    });
  }

  beforeEach(async () => {
    delete document.body.dataset.bootSettled;
    dependencies = restoringDependencies();
    container = document.createElement('div');
    document.body.append(container);
    await mount(dependencies);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    delete document.body.dataset.bootSettled;
  });

  it('starts with one folder sidebar and the Agent workspace', () => {
    const sidebars = container.querySelectorAll('[data-slot="sidebar"]'); // dom-contract: sidebar primitive state

    expect(sidebars).toHaveLength(1);
    expect(sidebars[0]?.getAttribute('data-variant')).toBe('inset');
    expect(container.querySelector('[data-slot="sidebar-inset"]')).not.toBeNull(); // dom-contract: sidebar primitive state
    expect(sidebars[0]?.textContent).toContain('StashBase');
    expect(within(container).getByLabelText('Agent workspace')).not.toBeNull();
    expect(sidebars[0]?.textContent).not.toContain('Files');
    expect(container.textContent).not.toContain('Document');
  });

  it('collapses the Files sidebar from the titlebar control', async () => {
    const sidebar = container.querySelector('[data-slot="sidebar"]'); // dom-contract: sidebar primitive state
    const toggle = within(container).getByRole('button', { name: 'Toggle files sidebar' });

    expect(sidebar?.getAttribute('data-state')).toBe('expanded');

    await act(async () => toggle.click());

    expect(sidebar?.getAttribute('data-state')).toBe('collapsed');
    await waitFor(() => {
      expect(dependencies.workspace.adapters.session.save).toHaveBeenCalledWith(
        expect.objectContaining({
          shell: { agentPaneWidth: 576, sidebarOpen: false, sidebarWidth: 240 },
        }),
      );
    });
  });

  it('applies restored sidebar geometry through the Fluid provider', async () => {
    await act(async () => root.unmount());
    await mount({
      ...dependencies,
      workspace: {
        ...dependencies.workspace,
        adapters: workspaceAdapters({
          ...dependencies.workspace.adapters,
          session: sessionPersistence({
            load: vi.fn(async () => ({
              activeFolderPath: null,
              folders: [],
              shell: { agentPaneWidth: 576, sidebarOpen: false, sidebarWidth: 312 },
              version: 1 as const,
            })),
          }),
        }),
      },
    });

    const wrapper = container.querySelector<HTMLElement>('[data-slot="sidebar-wrapper"]'); // dom-contract: sidebar primitive state
    const sidebar = container.querySelector('[data-slot="sidebar"]'); // dom-contract: sidebar primitive state
    expect(wrapper?.style.getPropertyValue('--sidebar-width')).toBe('312px');
    expect(sidebar?.getAttribute('data-state')).toBe('collapsed');
  });

  it('keeps the expand control clear of a floating sidebar', async () => {
    const toggle = within(container).getByRole('button', { name: 'Toggle files sidebar' });

    await act(async () => toggle.click());
    // The peek arms on a 150ms hover intent, so the delay is the behaviour
    // under test: pointing at the expand control must never arm it.
    vi.useFakeTimers();
    try {
      await act(async () => {
        toggle.dispatchEvent(
          new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }),
        );
        vi.advanceTimersByTime(500);
      });
    } finally {
      vi.useRealTimers();
    }

    expect(container.querySelector('[data-sidebar="peek"]')).toBeNull(); // dom-contract: sidebar primitive state
  });

  it('opens an eligible file-tree source into the document workspace', async () => {
    await act(async () => root.unmount());
    await mount({
      ...dependencies,
      documents: {
        ...dependencies.documents,
        adapters: documentAdapters({
          source: sourceApi({
            load: vi.fn(async () => ({ content: '# Plan', format: 'md' as const, version: 'v1' })),
          }),
        }),
        createId: vi.fn(() => 'document-tab'),
      },
      library: {
        ...dependencies.library,
        api: libraryApi({
          load: vi.fn(async () =>
            librarySnapshot({
              activeFolder: { name: 'Notes', path: '/library/notes' },
              members: [
                { favorite: false, openedAt: '2026-09-02T00:00:00.000Z', path: '/library/notes' },
              ],
            }),
          ),
        }),
      },
      workspace: {
        ...dependencies.workspace,
        adapters: workspaceAdapters({
          ...dependencies.workspace.adapters,
          files: filesApi({
            load: vi.fn(async () =>
              listing([listingFile({ heading: 'Plan', path: 'plan.md' })], [], 'Notes'),
            ),
          }),
        }),
      },
    });

    const view = within(container);
    await waitFor(() => {
      expect(view.getByRole('treeitem', { name: 'plan.md' })).not.toBeNull();
      expect(document.body.dataset.bootSettled).toBe('1');
    });
    await act(async () => view.getByRole('treeitem', { name: 'plan.md' }).click());

    const workspace = view.getByLabelText('Document workspace');
    const tab = view.getByRole('tab', { name: 'plan.md' });
    expect(tab.textContent).toContain('plan.md');
    expect(tab.closest('header')).not.toBeNull();
    // The tab strip lives in the window's title row, never inside the document.
    expect(within(workspace).queryByRole('tablist')).toBeNull();
    await waitFor(
      () => {
        expect(
          within(view.getByLabelText('plan.md Markdown content')).getByRole('heading', { level: 1 })
            .textContent,
        ).toContain('Plan');
      },
      { timeout: 5_000 },
    );
    await waitFor(() => {
      const outline = view.getByLabelText('Document outline section');
      expect(outline.closest('[data-sidebar="content"]')).not.toBeNull();
      expect(outline.closest('[data-sidebar="footer"]')).toBeNull();
    });

    const navigator = within(view.getByRole('tablist', { name: 'Sidebar navigator' }));
    const filesTab = navigator.getByRole('tab', { name: 'Files' });
    const outlineTab = navigator.getByRole('tab', { name: 'Document outline' });
    const searchTab = navigator.getByRole('tab', { name: 'Search' });
    // The navigator is icon-only: each tab is named by its label alone.
    expect(filesTab.textContent).toBe('');
    expect(outlineTab.textContent).toBe('');
    expect(searchTab.textContent).toBe('');
    expect(filesTab.getAttribute('aria-selected')).toBe('true');

    const generalSearch = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: 'f',
      shiftKey: true,
    });
    await act(async () => {
      document.dispatchEvent(generalSearch);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(generalSearch.defaultPrevented).toBe(true);
    expect(searchTab.getAttribute('aria-selected')).toBe('true');
    expect(view.getByLabelText('Exact workspace search')).not.toBeNull();
    expect(view.getByPlaceholderText('Search files').matches(':focus')).toBe(true);

    const elsewhere = document.createElement('button');
    container.append(elsewhere);
    elsewhere.focus();
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          key: 'f',
          shiftKey: true,
        }),
      );
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(view.getByPlaceholderText('Search files').matches(':focus')).toBe(true);

    await act(async () => outlineTab.click());

    expect(outlineTab.getAttribute('aria-selected')).toBe('true');
    expect(
      document.getElementById(filesTab.getAttribute('aria-controls') ?? '')?.hasAttribute('hidden'),
    ).toBe(true);
    expect(
      document
        .getElementById(outlineTab?.getAttribute('aria-controls') ?? '')
        ?.hasAttribute('hidden'),
    ).toBe(false);
  });
});
