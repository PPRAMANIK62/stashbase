import { FileText } from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

import './app.css';

export function App() {
  return (
    <SidebarProvider
      className="workspace-shell h-svh min-h-0 overflow-hidden bg-surface-1"
      persist={false}
      width="15rem"
    >
      <Sidebar className="bg-surface-1" variant="inset">
        <SidebarHeader
          aria-hidden="true"
          className="workspace-titlebar h-11 border-b border-border p-0"
        />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="gap-2">
              <FileText aria-hidden="true" size={14} strokeWidth={1.5} />
              Files
            </SidebarGroupLabel>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="!m-2 min-h-0 overflow-hidden">
        <header className="workspace-titlebar flex h-11 shrink-0 items-center border-b border-border px-2">
          <div className="workspace-titlebar-controls">
            <SidebarTrigger aria-label="Toggle files sidebar" />
          </div>
          <div className="min-w-0 flex-1 px-2 text-center">
            <span className="text-caption font-medium text-muted-foreground">Agent</span>
          </div>
          <div aria-hidden="true" className="size-9 shrink-0" />
        </header>

        <section aria-label="Agent workspace" className="min-h-0 flex-1" />
      </SidebarInset>
    </SidebarProvider>
  );
}
