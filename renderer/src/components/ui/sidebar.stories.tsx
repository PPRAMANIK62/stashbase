import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileText, Folder, Search, Settings, SquareLibrary } from 'lucide-react';
import { useState } from 'react';

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

function SidebarExample() {
  const [current, setCurrent] = useState('Library');
  return (
    <div className="h-[34rem] w-[min(100vw-3rem,58rem)] overflow-hidden bg-background">
      <SidebarProvider className="h-full" persist={false}>
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
                      onClick={() => setCurrent(item.label)}
                    >
                      {item.label}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu aria-label="Workspace settings">
              <SidebarMenuItem>
                <SidebarMenuButton icon={Settings}>Settings</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 border-b px-3">
            <SidebarTrigger aria-label="Toggle sidebar" />
            <span className="text-sm font-medium">{current}</span>
          </header>
          <main className="p-5">
            <Search className="mb-3 text-muted-foreground" size={18} />
            <h2 className="text-lg font-semibold">{current}</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              This composition covers the provider, core sidebar, menu primitives, and inset
              content.
            </p>
          </main>
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
  },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj;

export const Workspace: Story = { render: () => <SidebarExample /> };
