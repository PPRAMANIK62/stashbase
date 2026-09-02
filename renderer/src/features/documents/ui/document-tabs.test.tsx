import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';

import { DocumentTabs } from './document-tabs';
import { DocumentWorkspace } from './document-workspace';

function createRuntime() {
  let next = 0;
  const runtime = createDocumentTabsRuntime({
    createId: () => `tab-${++next}`,
    createQueries: () => ({ cancel: vi.fn(async () => undefined), remove: vi.fn() }),
    folderPath: '/library/notes',
    generation: 1,
  });
  runtime.open({ folderPath: '/library/notes', path: 'plan.md' });
  runtime.open({ folderPath: '/library/notes', path: 'drafts/other.md' });
  return runtime;
}

const sourceApi = {
  load: vi.fn(async () => ({ content: '# Loaded', format: 'md' as const, version: 'v1' })),
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
  it('renders one accessible tab per source and activates through the primitive', async () => {
    const runtime = createRuntime();
    runtimes.push(runtime);
    render(
      <QueryClientProvider client={testQueryClient()}>
        <DocumentTabs runtime={runtime} />
        <DocumentWorkspace api={sourceApi} runtime={runtime} />
      </QueryClientProvider>,
    );

    const tabList = screen.getByRole('tablist', { name: 'Open documents' });
    expect(tabList.classList.contains('overflow-x-auto')).toBe(true);
    expect(tabList.classList.contains('scrollbar-hide')).toBe(true);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'other.md' }).getAttribute('aria-selected')).toBe(
      'true',
    );

    await userEvent.setup().click(screen.getByRole('tab', { name: 'plan.md' }));

    expect(runtime.store.getState().activeTabId).toBe('tab-1');
    expect(screen.getByRole('region', { name: 'plan.md document' })).not.toBeNull();
  });

  it('closes the focused tab with Delete and exposes an active-tab close control', async () => {
    const runtime = createRuntime();
    runtimes.push(runtime);
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={testQueryClient()}>
        <DocumentTabs runtime={runtime} />
        <DocumentWorkspace api={sourceApi} runtime={runtime} />
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

  it('keeps a newly opened active tab visible in an overflowing tab list', () => {
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

    act(() => {
      runtime.open({ folderPath: '/library/notes', path: 'newly-opened.md' });
    });

    const newlyOpened = screen.getByRole('tab', { name: 'newly-opened.md' });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
    expect(scrollIntoView.mock.instances.at(-1)).toBe(newlyOpened);
  });
});
