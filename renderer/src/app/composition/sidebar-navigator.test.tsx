import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { SidebarProvider } from '@/components/ui/sidebar';
import { createDocumentTabsRuntime } from '@/features/documents/public';

import { SidebarNavigator } from './sidebar-navigator';

function createRuntime() {
  return createDocumentTabsRuntime({
    api: {
      load: vi.fn(),
      overwrite: vi.fn(),
      save: vi.fn(),
    },
    createId: () => 'tab-1',
    createQueries: () => ({
      cancel: vi.fn(async () => undefined),
      remove: vi.fn(),
      replaceSource: vi.fn(),
    }),
    folderPath: '/library/notes',
    generation: 1,
  });
}

let getAnimationsDescriptor: PropertyDescriptor | undefined;

function Navigator({ runtime = null }: { runtime?: ReturnType<typeof createRuntime> | null }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  return (
    <SidebarNavigator
      onSelect={setSelectedIndex}
      runtime={runtime}
      search={
        <label>
          Search panel
          <input aria-label="Search library" />
        </label>
      }
      selectedIndex={selectedIndex}
    >
      <div>Folder files</div>
    </SidebarNavigator>
  );
}

beforeEach(() => {
  getAnimationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    value: vi.fn(() => []),
  });
});

afterEach(() => {
  cleanup();
  if (getAnimationsDescriptor) {
    Object.defineProperty(Element.prototype, 'getAnimations', getAnimationsDescriptor);
  } else {
    Reflect.deleteProperty(Element.prototype, 'getAnimations');
  }
  getAnimationsDescriptor = undefined;
});

describe('sidebar navigator', () => {
  it('keeps the navigator available while the document runtime initializes', async () => {
    render(
      <SidebarProvider>
        <Navigator />
      </SidebarProvider>,
    );

    expect(screen.getByRole('tablist', { name: 'Sidebar navigator' })).not.toBeNull();
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Document outline' }));
    expect(screen.getByText('No outline available')).not.toBeNull();
  });

  it('keeps Files, Document outline, and Search available without an open document', async () => {
    const runtime = createRuntime();

    render(
      <SidebarProvider>
        <Navigator runtime={runtime} />
      </SidebarProvider>,
    );

    const navigator = screen.getByRole('tablist', { name: 'Sidebar navigator' });
    expect(navigator).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Files' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Search' })).not.toBeNull();

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Document outline' }));

    expect(screen.getByText('No outline available')).not.toBeNull();
    runtime.dispose();
  });

  it('shows the Search panel and focuses its field from the tab', async () => {
    render(
      <SidebarProvider>
        <Navigator />
      </SidebarProvider>,
    );

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Search' }));

    expect(screen.getByRole('tab', { name: 'Search' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'Search library' })).not.toBeNull();
  });
});
