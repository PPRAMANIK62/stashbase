import { waitFor } from '@testing-library/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { AppDependencies } from '@/app/dependencies';
import { Providers } from '@/app/providers';
import { App } from '@/app/shell';

describe('workspace shell', () => {
  let container: HTMLDivElement;
  let root: Root;
  let getAnimationsDescriptor: PropertyDescriptor | undefined;
  const dependencies: AppDependencies = {
    documents: {
      assetApi: { load: vi.fn(() => new Promise<never>(() => undefined)) },
      docxPreviewApi: { load: vi.fn(() => new Promise<never>(() => undefined)) },
      sourceApi: {
        load: vi.fn<AppDependencies['documents']['sourceApi']['load']>(() => new Promise(() => {})),
        overwrite: vi.fn(),
        save: vi.fn(),
      },
      createId: vi.fn(() => 'tab-1'),
      genericPreviewApi: { load: vi.fn(() => new Promise<never>(() => undefined)) },
      lifecycle: { onPrepareContextRelease: vi.fn(() => () => undefined) },
      mediaApi: {
        cancelTranscript: vi.fn(),
        loadPreviewStatus: vi.fn(),
        loadTranscript: vi.fn(() => new Promise<never>(() => undefined)),
        preparePreview: vi.fn(),
        reprocessTranscript: vi.fn(),
      },
      openExternal: vi.fn(async () => true),
    },
    library: {
      folderPicker: { chooseFolder: vi.fn() },
      api: {
        load: () => new Promise(() => {}),
        openFolder: vi.fn(),
        removeFolder: vi.fn(),
      },
      lifecycle: {
        notifyFolderRemoved: vi.fn(async () => undefined),
        onFolderRemoved: vi.fn(() => () => undefined),
        onPrepareFolderRemoval: vi.fn(() => () => undefined),
        prepareFolderRemoval: vi.fn(),
        setActiveFolder: vi.fn(async () => undefined),
      },
    },
    session: {
      load: vi.fn(async () => null),
      save: vi.fn(async () => undefined),
    },
    workspace: {
      api: { load: vi.fn(), reveal: vi.fn() },
      revealLabel: 'Show in file manager',
    },
  };

  beforeEach(async () => {
    dependencies.session = {
      load: vi.fn(async () => null),
      save: vi.fn(async () => undefined),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    );
    getAnimationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
    Object.defineProperty(Element.prototype, 'getAnimations', {
      configurable: true,
      value: vi.fn(() => []),
    });
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <Providers>
          <App dependencies={dependencies} />
        </Providers>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    if (getAnimationsDescriptor) {
      Object.defineProperty(Element.prototype, 'getAnimations', getAnimationsDescriptor);
    } else {
      Reflect.deleteProperty(Element.prototype, 'getAnimations');
    }
    vi.unstubAllGlobals();
  });

  it('starts with one folder sidebar and the Agent workspace', () => {
    const sidebar = container.querySelector('[data-slot="sidebar"]');
    const workspace = container.querySelector('[data-slot="sidebar-inset"]');

    expect(container.querySelectorAll('[data-slot="sidebar"]')).toHaveLength(1);
    expect(sidebar?.getAttribute('data-variant')).toBe('inset');
    expect(sidebar?.className).toContain('bg-surface-1');
    expect(workspace?.classList.contains('!m-2')).toBe(false);
    expect(workspace?.className).toContain('peer-data-[variant=inset]:peer-data-[side=left]:ml-0');
    expect(workspace?.className).toContain('peer-data-[variant=inset]:bg-surface-2');
    expect(sidebar?.textContent).toContain('StashBase');
    expect(sidebar?.querySelector('[data-sidebar="header"]')?.classList.contains('border-b')).toBe(
      false,
    );
    expect(container.querySelector('[aria-label="Agent workspace"]')).not.toBeNull();
    expect(sidebar?.textContent).not.toContain('Files');
    expect(container.textContent).not.toContain('Document');
  });

  it('collapses the Files sidebar from the titlebar control', async () => {
    const sidebar = container.querySelector('[data-slot="sidebar"]');
    const toggle = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle files sidebar"]',
    );

    expect(sidebar?.getAttribute('data-state')).toBe('expanded');
    expect(toggle).not.toBeNull();

    await act(async () => toggle?.click());

    expect(sidebar?.getAttribute('data-state')).toBe('collapsed');
    await act(async () => Promise.resolve());
    expect(dependencies.session.save).toHaveBeenCalledWith(
      expect.objectContaining({ shell: { sidebarOpen: false, sidebarWidth: 240 } }),
    );
  });

  it('applies restored sidebar geometry through the Fluid provider', async () => {
    await act(async () => root.unmount());
    dependencies.session = {
      load: vi.fn(async () => ({
        activeFolderPath: null,
        folders: [],
        shell: { sidebarOpen: false, sidebarWidth: 312 },
        version: 1 as const,
      })),
      save: vi.fn(async () => undefined),
    };
    root = createRoot(container);

    await act(async () => {
      root.render(
        <Providers>
          <App dependencies={dependencies} />
        </Providers>,
      );
      await Promise.resolve();
    });

    const wrapper = container.querySelector<HTMLElement>('[data-slot="sidebar-wrapper"]');
    const sidebar = container.querySelector('[data-slot="sidebar"]');
    expect(wrapper?.style.getPropertyValue('--sidebar-width')).toBe('312px');
    expect(sidebar?.getAttribute('data-state')).toBe('collapsed');
  });

  it('keeps the expand control clear of a floating sidebar', async () => {
    const toggle = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle files sidebar"]',
    );

    await act(async () => toggle?.click());
    await act(async () => {
      toggle?.dispatchEvent(
        new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }),
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
    });

    expect(container.querySelector('[data-sidebar="peek"]')).toBeNull();
  });

  it('opens an eligible file-tree source into the document workspace', async () => {
    await act(async () => root.unmount());
    const activeDependencies: AppDependencies = {
      ...dependencies,
      documents: {
        assetApi: dependencies.documents.assetApi,
        docxPreviewApi: dependencies.documents.docxPreviewApi,
        sourceApi: {
          load: vi.fn(async () => ({ content: '# Plan', format: 'md' as const, version: 'v1' })),
          overwrite: vi.fn(),
          save: vi.fn(),
        },
        createId: vi.fn(() => 'document-tab'),
        genericPreviewApi: { load: vi.fn(() => new Promise<never>(() => undefined)) },
        lifecycle: dependencies.documents.lifecycle,
        mediaApi: dependencies.documents.mediaApi,
        openExternal: dependencies.documents.openExternal,
      },
      library: {
        ...dependencies.library,
        api: {
          ...dependencies.library.api,
          load: vi.fn(async () => ({
            activeFolder: { name: 'Notes', path: '/library/notes' },
            homeDirectory: '/home/person',
            members: [
              { favorite: false, openedAt: '2026-09-02T00:00:00.000Z', path: '/library/notes' },
            ],
          })),
        },
      },
      workspace: {
        ...dependencies.workspace,
        api: {
          ...dependencies.workspace.api,
          load: vi.fn(async () => ({
            files: [
              {
                availability: 'available' as const,
                format: 'md' as const,
                heading: 'Plan',
                importedAt: '',
                kind: 'regular' as const,
                path: 'plan.md',
                size: 12,
                snippet: '',
              },
            ],
            folderName: 'Notes',
            folders: [],
          })),
        },
      },
    };
    root = createRoot(container);

    await act(async () => {
      root.render(
        <Providers>
          <App dependencies={activeDependencies} />
        </Providers>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    let source: HTMLButtonElement | null = null;
    await waitFor(() => {
      source = container.querySelector<HTMLButtonElement>(
        '[role="treeitem"][aria-label="plan.md"]',
      );
      expect(source).not.toBeNull();
    });
    await act(async () => source?.click());

    expect(container.querySelector('[aria-label="Document workspace"]')).not.toBeNull();
    const tab = container.querySelector('[role="tab"][aria-label="plan.md"]');
    expect(tab?.textContent).toContain('plan.md');
    expect(tab?.closest('header')).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Document workspace"] [role="tablist"]'),
    ).toBeNull();
    await waitFor(
      () => {
        expect(
          container.querySelector('[aria-label="plan.md Markdown content"] h1')?.textContent,
        ).toContain('Plan');
      },
      { timeout: 5_000 },
    );
    await waitFor(() => {
      const outline = container.querySelector('[aria-label="Document outline section"]');
      expect(outline?.closest('[data-sidebar="content"]')).not.toBeNull();
      expect(outline?.closest('[data-sidebar="footer"]')).toBeNull();
    });

    const navigator = container.querySelector('[role="tablist"][aria-label="Sidebar navigator"]');
    expect(navigator).not.toBeNull();
    expect(navigator?.parentElement?.classList.contains('justify-center')).toBe(true);
    const filesTab = navigator?.querySelector<HTMLButtonElement>(
      '[role="tab"][aria-label="Files"]',
    );
    const outlineTab = navigator?.querySelector<HTMLButtonElement>(
      '[role="tab"][aria-label="Document outline"]',
    );
    expect(filesTab?.textContent).toBe('');
    expect(outlineTab?.textContent).toBe('');
    expect(filesTab?.getAttribute('aria-selected')).toBe('true');

    await act(async () => outlineTab?.click());

    expect(outlineTab?.getAttribute('aria-selected')).toBe('true');
    expect(
      document
        .getElementById(filesTab?.getAttribute('aria-controls') ?? '')
        ?.hasAttribute('hidden'),
    ).toBe(true);
    expect(
      document
        .getElementById(outlineTab?.getAttribute('aria-controls') ?? '')
        ?.hasAttribute('hidden'),
    ).toBe(false);
  });
});
