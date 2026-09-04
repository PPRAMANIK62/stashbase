import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { DocumentSourceApi } from '@/features/documents/application/ports';
import { createDocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';

import { DocumentOutline } from './outline';
import { DocumentTabs } from './tabs';
import { DocumentWorkspace } from './workspace';

function createRuntime(api: DocumentSourceApi = sourceApi) {
  let next = 2;
  const runtime = createDocumentTabsRuntime({
    api,
    createId: () => `tab-${++next}`,
    createQueries: () => ({
      cancel: vi.fn(async () => undefined),
      remove: vi.fn(),
      replaceSource: vi.fn(),
    }),
    folderPath: '/library/notes',
    generation: 1,
    restored: {
      activeTabId: 'tab-2',
      tabs: [
        { id: 'tab-1', source: { folderPath: '/library/notes', path: 'plan.md' } },
        {
          id: 'tab-2',
          source: { folderPath: '/library/notes', path: 'drafts/other.md' },
        },
      ],
    },
  });
  return runtime;
}

const sourceApi = {
  load: vi.fn(async () => ({ content: '# Loaded', format: 'md' as const, version: 'v1' })),
  overwrite: vi.fn(),
  save: vi.fn(),
};

const documentWorkspaceProps = {
  assetApi: { load: vi.fn(() => new Promise<never>(() => undefined)) },
  docxPreviewApi: { load: vi.fn(() => new Promise<never>(() => undefined)) },
  genericPreviewApi: { load: vi.fn(() => new Promise<never>(() => undefined)) },
  mediaApi: {
    cancelTranscript: vi.fn(),
    loadPreviewStatus: vi.fn(),
    loadTranscript: vi.fn(() => new Promise<never>(() => undefined)),
    preparePreview: vi.fn(),
    reprocessTranscript: vi.fn(),
  },
  onReveal: vi.fn(async () => undefined),
  revealLabel: 'Show in file manager',
};

function testQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const runtimes: ReturnType<typeof createRuntime>[] = [];
let scrollIntoViewDescriptor: PropertyDescriptor | undefined;
let getAnimationsDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  getAnimationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    value: vi.fn(() => []),
  });
});

afterEach(() => {
  cleanup();
  for (const runtime of runtimes.splice(0)) runtime.dispose();
  if (scrollIntoViewDescriptor) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoViewDescriptor);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  }
  scrollIntoViewDescriptor = undefined;
  if (getAnimationsDescriptor) {
    Object.defineProperty(Element.prototype, 'getAnimations', getAnimationsDescriptor);
  } else {
    Reflect.deleteProperty(Element.prototype, 'getAnimations');
  }
  getAnimationsDescriptor = undefined;
});

describe('document tabs', () => {
  it('renders and operates the active document outline hierarchy', async () => {
    const runtime = createRuntime();
    runtimes.push(runtime);
    const owner = Symbol('outline-test');
    const select = vi.fn();
    const parent = { id: 'plan', level: 1, position: 1, text: 'Plan' };
    const child = { id: 'details', level: 2, position: 8, text: 'Details' };
    runtime.navigation.claimOutline('tab-2', owner);
    runtime.navigation.publishOutline(
      'tab-2',
      owner,
      { activeId: child.id, headings: [parent, child] },
      select,
    );

    render(<DocumentOutline runtime={runtime} />);

    const section = screen.getByLabelText('Document outline section');
    expect(section.dataset.sidebar).toBe('group');
    expect(section.classList.contains('p-0')).toBe(true);
    expect(section.classList.contains('border-t')).toBe(false);
    expect(screen.getByLabelText('other.md outline, 2 headings').className).toContain('h-7');
    expect(section.querySelector('[data-slot="scroll-area"]')).toBeNull();
    expect(
      screen
        .getByRole('navigation', { name: 'Document outline' })
        .querySelector('[data-sidebar="menu-sub"]'),
    ).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'Heading level 2: Details' }).getAttribute('aria-current'),
    ).toBe('location');
    expect(screen.getByRole('button', { name: 'Collapse Plan' }).className).toContain('left-1');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Collapse Plan' }));
    expect(screen.queryByRole('button', { name: 'Heading level 2: Details' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Expand Plan' }));
    await user.click(screen.getByRole('button', { name: 'Heading level 1: Plan' }));

    expect(select).toHaveBeenCalledWith(parent);
  });

  it('explains unavailable and empty document outlines', () => {
    const runtime = createRuntime();
    runtimes.push(runtime);
    const { rerender } = render(<DocumentOutline runtime={runtime} />);

    expect(screen.getByLabelText('Document outline section')).not.toBeNull();
    expect(screen.getByLabelText('other.md outline, unavailable')).not.toBeNull();
    expect(screen.getByText('No outline available for this document')).not.toBeNull();

    const owner = Symbol('empty-outline-test');
    runtime.navigation.claimOutline('tab-2', owner);
    runtime.navigation.publishOutline('tab-2', owner, { activeId: null, headings: [] }, vi.fn());
    rerender(<DocumentOutline runtime={runtime} />);

    expect(screen.getByLabelText('other.md outline, 0 headings')).not.toBeNull();
    expect(screen.getByText('No headings in this document')).not.toBeNull();
    expect(screen.queryByText('No outline available for this document')).toBeNull();
    expect(screen.queryByText('Outline')).toBeNull();
  });

  it('renders one accessible tab per source and activates through the primitive', async () => {
    const runtime = createRuntime();
    runtimes.push(runtime);
    render(
      <QueryClientProvider client={testQueryClient()}>
        <DocumentTabs runtime={runtime} />
        <DocumentWorkspace {...documentWorkspaceProps} runtime={runtime} sourceApi={sourceApi} />
      </QueryClientProvider>,
    );

    const tabList = screen.getByRole('tablist', { name: 'Open documents' });
    expect(tabList.classList.contains('overflow-x-auto')).toBe(true);
    expect(tabList.classList.contains('scrollbar-hide')).toBe(true);
    const tabs = within(tabList).getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs.map((tab) => tab.getAttribute('data-proximity-index'))).toEqual(['0', '1']);
    expect(screen.getByRole('tab', { name: 'other.md' }).getAttribute('aria-selected')).toBe(
      'true',
    );

    await userEvent.setup().click(screen.getByRole('tab', { name: 'plan.md' }));

    expect(runtime.store.getState().activeTabId).toBe('tab-1');
    expect(screen.getByRole('region', { name: 'plan.md document' })).not.toBeNull();
    expect(
      screen
        .getByRole('region', { name: 'plan.md document' })
        .ownerDocument.querySelector('[aria-label="other.md document"]')
        ?.classList.contains('hidden'),
    ).toBe(true);
  });

  it('closes the focused tab with Delete and exposes an active-tab close control', async () => {
    const runtime = createRuntime();
    runtimes.push(runtime);
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={testQueryClient()}>
        <DocumentTabs runtime={runtime} />
        <DocumentWorkspace {...documentWorkspaceProps} runtime={runtime} sourceApi={sourceApi} />
      </QueryClientProvider>,
    );

    const other = screen.getByRole('tab', { name: 'other.md' });
    other.focus();
    await user.keyboard('{Delete}');

    expect(runtime.store.getState().tabs.map((tab) => tab.id)).toEqual(['tab-1']);
    expect(other.ownerDocument.activeElement).toBe(screen.getByRole('tab', { name: 'plan.md' }));
    const closeGlyph = screen
      .getByRole('tab', { name: 'plan.md' })
      .querySelector<HTMLElement>('[data-tab-trailing]');
    expect(closeGlyph).not.toBeNull();
    await user.click(closeGlyph as HTMLElement);
    expect(screen.queryByRole('region', { name: 'Document workspace' })).toBeNull();
  });

  it('keeps a newly opened active tab visible in an overflowing tab list', async () => {
    const runtime = createRuntime();
    runtimes.push(runtime);
    const scrollIntoView = vi.fn();
    scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollIntoView',
    );
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    render(<DocumentTabs runtime={runtime} />);
    scrollIntoView.mockClear();

    await act(async () => {
      await runtime.open({ folderPath: '/library/notes', path: 'newly-opened.md' });
    });

    const newlyOpened = screen.getByRole('tab', { name: 'newly-opened.md' });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
    expect(scrollIntoView.mock.instances.at(-1)).toBe(newlyOpened);
  });

  it('switches one retained Markdown surface between Writer and Reading modes', async () => {
    const runtime = createRuntime();
    runtimes.push(runtime);
    render(
      <QueryClientProvider client={testQueryClient()}>
        <DocumentTabs runtime={runtime} />
        <DocumentWorkspace {...documentWorkspaceProps} runtime={runtime} sourceApi={sourceApi} />
      </QueryClientProvider>,
    );

    const document = await screen.findByRole(
      'document',
      { name: 'other.md Markdown content' },
      { timeout: 5_000 },
    );
    await waitFor(() => expect(document.querySelector('.ProseMirror')).not.toBeNull(), {
      timeout: 5_000,
    });
    const editor = document.querySelector('.ProseMirror');
    const modes = screen.getByRole('tablist', { name: 'Markdown mode' });
    expect(document.contains(modes)).toBe(true);
    expect(within(modes).queryByText('Writer')).toBeNull();
    expect(within(modes).queryByText('Reading')).toBeNull();

    await userEvent.setup().click(within(modes).getByRole('tab', { name: 'Reading' }));

    expect(runtime.getDocument('tab-2')?.store.getState().markdownMode).toBe('reading');
    await waitFor(() => expect(editor?.getAttribute('contenteditable')).toBe('false'));
    expect(document.querySelector('.ProseMirror')).toBe(editor);

    await userEvent.setup().click(within(modes).getByRole('tab', { name: 'Writer' }));

    expect(runtime.getDocument('tab-2')?.store.getState().markdownMode).toBe('writer');
    await waitFor(() => expect(editor?.getAttribute('contenteditable')).toBe('true'));
    expect(document.querySelector('.ProseMirror')).toBe(editor);
  });

  it('keeps a recent Markdown editor mounted and revalidates it when reactivated', async () => {
    const api = {
      load: vi.fn(async (source: { path: string }) => ({
        content: source.path === 'plan.md' ? '# Plan' : '# Other',
        format: 'md' as const,
        version: 'v1',
      })),
      overwrite: vi.fn(),
      save: vi.fn(),
    };
    const runtime = createRuntime(api);
    runtimes.push(runtime);
    render(
      <QueryClientProvider client={testQueryClient()}>
        <DocumentTabs runtime={runtime} />
        <DocumentWorkspace {...documentWorkspaceProps} runtime={runtime} sourceApi={api} />
      </QueryClientProvider>,
    );

    const retained = await screen.findByRole(
      'document',
      { name: 'other.md Markdown content' },
      { timeout: 5_000 },
    );
    await userEvent.setup().click(screen.getByRole('tab', { name: 'plan.md' }));
    await screen.findByRole('document', { name: 'plan.md Markdown content' }, { timeout: 5_000 });
    await userEvent.setup().click(screen.getByRole('tab', { name: 'other.md' }));

    expect(screen.getByRole('document', { name: 'other.md Markdown content' })).toBe(retained);
    await waitFor(() => expect(api.load).toHaveBeenCalledTimes(3));
    expect(api.load.mock.calls.at(-1)?.[0]).toEqual({
      folderPath: '/library/notes',
      path: 'drafts/other.md',
    });
  });

  it('replaces the close glyph with a filled circle until an edit is saved', async () => {
    let acceptSave: ((value: { content: string; format: 'md'; version: string }) => void) | null =
      null;
    const api = {
      load: vi.fn(async () => ({ content: '# Loaded', format: 'md' as const, version: 'v1' })),
      overwrite: vi.fn(),
      save: vi.fn(
        () =>
          new Promise<{ content: string; format: 'md'; version: string }>((resolve) => {
            acceptSave = resolve;
          }),
      ),
    };
    const runtime = createRuntime(api);
    runtimes.push(runtime);
    render(
      <QueryClientProvider client={testQueryClient()}>
        <DocumentTabs runtime={runtime} />
        <DocumentWorkspace {...documentWorkspaceProps} runtime={runtime} sourceApi={api} />
      </QueryClientProvider>,
    );

    await userEvent.setup().click(screen.getByRole('tab', { name: 'plan.md' }));
    await waitFor(() =>
      expect(runtime.getDocument('tab-1')?.store.getState().editor).not.toBeNull(),
    );
    act(() => runtime.getDocument('tab-1')?.change('# Draft'));

    const dirtyTab = screen.getByRole('tab', { name: 'plan.md, unsaved changes' });
    expect(dirtyTab.querySelector('[data-unsaved-indicator]')).not.toBeNull();
    expect(dirtyTab.getAttribute('data-document-dirty')).toBe('true');

    let save: Promise<boolean> | undefined;
    act(() => {
      save = runtime.getDocument('tab-1')?.save(api);
    });
    expect(dirtyTab.querySelector('[data-unsaved-indicator]')).not.toBeNull();

    await act(async () => {
      acceptSave?.({ content: '# Draft', format: 'md', version: 'v2' });
      await save;
    });

    const savedTab = screen.getByRole('tab', { name: 'plan.md' });
    expect(savedTab.querySelector('[data-unsaved-indicator]')).toBeNull();
    expect(savedTab.getAttribute('data-document-dirty')).toBeNull();
    expect(savedTab.querySelector('[data-tab-trailing]')).not.toBeNull();
  });
});
