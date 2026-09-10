import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Bot, FolderTree } from 'lucide-react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import type { SidebarPanelId } from '@/app/composition/commands/use-workspace-commands';
import { SidebarProvider } from '@/components/ui/sidebar';
import { createDocumentTabsRuntime } from '@/features/documents/public';
import { documentTabsRuntimeOptions } from '@/test/fakes/documents';

import { SidebarNavigator } from './sidebar-navigator';
import { sidebarPanels, type SidebarPanel } from './sidebar-panels';

function createRuntime() {
  return createDocumentTabsRuntime(documentTabsRuntimeOptions({ createId: () => 'tab-1' }));
}

function Navigator({ panels }: { panels: readonly SidebarPanel[] }) {
  const [selected, setSelected] = useState<SidebarPanelId>('files');
  return (
    <SidebarProvider>
      <SidebarNavigator onSelect={setSelected} panels={panels} selected={selected} />
    </SidebarProvider>
  );
}

function shellPanels(runtime: ReturnType<typeof createRuntime> | null = null) {
  return sidebarPanels({
    chats: <div>Folder chats</div>,
    files: <div>Folder files</div>,
    outline: runtime,
    search: (
      <label>
        Search panel
        <input aria-label="Search current workspace" />
      </label>
    ),
  });
}

afterEach(cleanup);

describe('sidebar navigator', () => {
  it('keeps the navigator available while the document runtime initializes', async () => {
    render(<Navigator panels={shellPanels()} />);

    expect(screen.getByRole('tablist', { name: 'Sidebar navigator' })).not.toBeNull();
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Document outline' }));
    expect(screen.getByText('No outline available')).not.toBeNull();
  });

  it('keeps Files, Document outline, Search, and Chats available without an open document', async () => {
    const runtime = createRuntime();

    render(<Navigator panels={shellPanels(runtime)} />);

    expect(screen.getByRole('tablist', { name: 'Sidebar navigator' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Files' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Search' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Chats' })).not.toBeNull();

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Document outline' }));

    expect(screen.getByText('No outline available')).not.toBeNull();
    runtime.dispose();
  });

  it('shows the Search panel and focuses its field from the tab', async () => {
    render(<Navigator panels={shellPanels()} />);

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Search' }));

    expect(screen.getByRole('tab', { name: 'Search' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'Search current workspace' })).not.toBeNull();
    // The files region leaves the column entirely, so the Search panel is not pushed halfway down
    // beside an empty flex frame. `data-sidebar="content"` is the app kit's own structural wrapper
    // with no role or label; the fact under test is the ancestor column's hidden state, not any
    // one tabpanel's, so there is no role query that reaches it instead.
    const filesRegion = document.querySelector('[data-sidebar="content"]'); // dom-contract: see comment above
    expect(filesRegion?.closest('[hidden]')).not.toBeNull();
  });

  it('mounts the Chats panel only once it is selected', async () => {
    render(<Navigator panels={shellPanels()} />);

    expect(screen.queryByText('Folder chats')).toBeNull();

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Chats' }));

    expect(screen.getByRole('tab', { name: 'Chats' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Folder chats')).not.toBeNull();
  });

  it('renders a tab and a pane for whatever the registry declares', async () => {
    const panels: SidebarPanel[] = [
      {
        hidesTree: false,
        icon: FolderTree,
        id: 'files',
        label: 'Files',
        render: () => <p>Tree</p>,
      },
      {
        hidesTree: true,
        icon: Bot,
        id: 'chats',
        label: 'Notebook',
        render: () => <p>Notebook pane</p>,
      },
    ];

    render(<Navigator panels={panels} />);
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Notebook' }));

    expect(screen.getByRole('tab', { name: 'Notebook' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByText('Notebook pane')).not.toBeNull();
    // The tree-region panel keeps its pane mounted; only the frame hides.
    expect(screen.getByText('Tree').closest('[hidden]')).not.toBeNull();
  });
});
