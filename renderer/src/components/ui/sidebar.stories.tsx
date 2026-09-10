import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileText, Folder, Search, Settings, SquareLibrary } from 'lucide-react';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import { SizeProvider } from '@/lib/size-context';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from './sidebar';

const navigation = [
  { icon: SquareLibrary, label: 'Library' },
  { icon: Folder, label: 'Projects' },
  { icon: FileText, label: 'Recent files' },
];

function SidebarExample({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const [current, setCurrent] = useState('Library');
  return (
    <div className="h-[34rem] w-[min(100vw-3rem,58rem)] overflow-hidden bg-background">
      <SidebarProvider className="h-full" defaultOpen={defaultOpen} persist={false}>
        <Sidebar collapsible="offcanvas" variant="inset">
          <SidebarHeader>
            <p className="px-3 py-2 text-sm font-semibold">Research workspace</p>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarMenu aria-label="Workspace navigation">
                {navigation.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      icon={item.icon}
                      isActive={current === item.label}
                      label={item.label}
                      onClick={() => setCurrent(item.label)}
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu aria-label="Workspace settings">
              <SidebarMenuItem>
                <SidebarMenuButton icon={Settings} label="Settings" />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 border-b px-3">
            <SidebarTrigger aria-label="Toggle sidebar" />
            <span className="text-sm font-medium">{current}</span>
          </header>
          {/* SidebarInset already renders the page's <main> landmark, so the
              body of the page is a plain block inside it. */}
          <div className="p-5">
            <Search className="mb-3 text-muted-foreground" size={18} />
            <h2 className="text-lg font-semibold">{current}</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              This composition covers the provider, core sidebar, menu primitives, and inset
              content.
            </p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

const meta = {
  title: 'Compositions/Sidebar',
  component: Sidebar,
  subcomponents: { SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton },
  parameters: {
    controls: { disable: true },
    fluidCanvas: { width: '60rem', minHeight: '37rem' },
    layout: 'fullscreen',
    // The composition renders the page's own <main> through SidebarInset, so
    // the canvas frame must not wrap a second one around it.
    ownsLandmarks: true,
  },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj;

export const Workspace: Story = {
  render: () => <SidebarExample />,
  // The menu is one roving tab stop, not four: arrows move between rows and
  // Enter activates. Driving that before the score means the run sees the row
  // that actually holds focus, and the tab stop that moved to it.
  play: async ({ canvasElement }) => {
    const menu = within(canvasElement).getByRole('list', { name: 'Workspace navigation' });
    const rows = within(menu).getAllByRole('button');
    rows[0]?.focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(rows[1]).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(rows[1]).toHaveAttribute('aria-current', 'page');
  },
};

/** Collapsed to the rail. The trigger in the inset header is the way back,
 *  and the menu keeps its roving tab stop while the panel is off-canvas. */
export const Collapsed: Story = { render: () => <SidebarExample defaultOpen={false} /> };

/** The compact step: 28px rows and one notch down in type, for a dense
 *  workspace where the sidebar is a tool rather than the page. */
export const Compact: Story = {
  render: () => (
    <SizeProvider size="compact">
      <SidebarExample />
    </SizeProvider>
  ),
};
