import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FolderTree, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  sidebarModeOf,
  type SidebarMode,
  type SidebarPanelId,
} from '@/app/composition/commands/use-workspace-commands';
import { SidebarProvider } from '@/components/ui/sidebar';
import { createDocumentTabsRuntime } from '@/features/documents/public';
import { documentTabsRuntimeOptions } from '@/test/fakes/documents';

import { SidebarModeSwitch } from './sidebar-mode-switch';
import { SidebarNavigator } from './sidebar-navigator';
import { sidebarModes, sidebarPanels, type SidebarPanel } from './sidebar-panels';

function createRuntime() {
  return createDocumentTabsRuntime(documentTabsRuntimeOptions({ createId: () => 'tab-1' }));
}

/** The band's switch and the navigator beneath it, wired the way the shell
 *  wires them: the switch lands Chats on its one panel and Documents on the
 *  documents panel that was showing last. */
function Navigator({ open = true, panels }: { open?: boolean; panels: readonly SidebarPanel[] }) {
  const [selected, setSelected] = useState<SidebarPanelId>('files');
  const [documentsPanel, setDocumentsPanel] = useState<SidebarPanelId>('files');
  const select = (panel: SidebarPanelId) => {
    if (sidebarModeOf(panel) === 'documents') setDocumentsPanel(panel);
    setSelected(panel);
  };
  const selectMode = (mode: SidebarMode) =>
    setSelected(mode === 'chats' ? 'chats' : documentsPanel);
  return (
    <SidebarProvider>
      <SidebarModeSwitch
        modes={sidebarModes}
        onSelect={selectMode}
        selected={sidebarModeOf(selected)}
      />
      <SidebarNavigator
        contentId="folder-content"
        onSelect={select}
        open={open}
        panels={panels}
        selected={selected}
      />
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

  it('offers Documents and Chats as modes, and Files, Document outline, and Search under Documents', async () => {
    const runtime = createRuntime();

    render(<Navigator panels={shellPanels(runtime)} />);

    const modes = screen.getByRole('tablist', { name: 'Sidebar mode' });
    expect(within(modes).getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Documents' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Chats' })).not.toBeNull();

    const navigator = screen.getByRole('tablist', { name: 'Sidebar navigator' });
    expect(within(navigator).getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Files' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Search' })).not.toBeNull();

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

  it('mounts the Chats panel only once its mode is chosen, with no strip of its own', async () => {
    render(<Navigator panels={shellPanels()} />);

    expect(screen.queryByText('Folder chats')).toBeNull();

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Chats' }));

    expect(screen.getByRole('tab', { name: 'Chats' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Folder chats')).not.toBeNull();
    // Chats is the mode's only panel, so the column holds it straight away.
    expect(screen.queryByRole('tablist', { name: 'Sidebar navigator' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Files' })).toBeNull();
  });

  it('comes back from Chats to the documents panel that was showing', async () => {
    render(<Navigator panels={shellPanels()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: 'Search' }));
    await user.click(screen.getByRole('tab', { name: 'Chats' }));
    expect(screen.getByText('Folder chats')).not.toBeNull();
    expect(screen.queryByRole('tab', { name: 'Search' })).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Documents' }));

    expect(screen.getByRole('tab', { name: 'Search' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'Search current workspace' })).not.toBeNull();
    // The mode being left slides off with its pane still mounted, so Chats
    // leaves the tree when the travel lands rather than on the click.
    await waitFor(() => expect(screen.queryByText('Folder chats')).toBeNull());
  });

  it('folds its region under the folder header and keeps the panes mounted', () => {
    render(<Navigator open={false} panels={shellPanels()} />);

    const region = document.getElementById('folder-content'); // dom-contract: the header's aria-controls target
    expect(region?.getAttribute('aria-hidden')).toBe('true');
    expect(region?.hasAttribute('inert')).toBe(true);
    expect(region?.textContent).toContain('Folder files');
    // The strip folds with the folder: it is the folder's views, under its header.
    expect(
      region?.contains(screen.getByRole('tablist', { hidden: true, name: 'Sidebar navigator' })),
    ).toBe(true);
  });

  it('renders a tab and a pane for whatever the registry declares', async () => {
    const panels: SidebarPanel[] = [
      {
        hidesTree: false,
        icon: FolderTree,
        id: 'files',
        label: 'Files',
        mode: 'documents',
        render: () => <p>Tree</p>,
      },
      {
        hidesTree: true,
        icon: MessageSquare,
        id: 'search',
        label: 'Notebook',
        mode: 'documents',
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
