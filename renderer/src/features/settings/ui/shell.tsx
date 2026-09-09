import { Menu } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { MobileDrawer } from '@/components/ui/mobile-drawer';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar-menu';
import { useCompactWindow } from '@/hooks/use-compact-window';
import type { IconComponent } from '@/lib/icon-context';
import { SizeProvider } from '@/lib/size-context';
import { cn } from '@/lib/utils';

/** Below this window width the nav rail collapses into a MobileDrawer,
 *  matching the compact-window behavior in the task-46 mockup. Nothing
 *  upstream drives the ambient size context off real window width, so this
 *  shell measures it directly (via the shared `useCompactWindow` hook, kept
 *  outside `features/*\/ui/` where the `window` global is off-limits) rather
 *  than reading a `compact` size variant that would otherwise never flip. */
const COMPACT_WINDOW_BREAKPOINT_PX = 640;

export type SettingsSectionDef =
  | {
      id: string;
      label: string;
      icon: IconComponent;
      available: true;
      render(): ReactNode;
    }
  | {
      id: string;
      label: string;
      icon: IconComponent;
      available: false;
    };

export interface SettingsShellProps {
  open: boolean;
  onClose: () => void;
  section: string;
  onSectionChange: (id: string) => void;
  sections: SettingsSectionDef[];
}

function SectionsNav({
  activeId,
  onSelect,
  sections,
}: {
  activeId: string;
  onSelect: (id: string) => void;
  sections: SettingsSectionDef[];
}) {
  return (
    <SidebarMenu aria-label="Settings sections">
      {sections.map((section) => (
        <SidebarMenuItem key={section.id}>
          <SidebarMenuButton
            disabled={!section.available}
            icon={section.icon}
            isActive={section.available && section.id === activeId}
            onClick={() => section.available && onSelect(section.id)}
            tabIndex={section.available ? undefined : -1}
          >
            {section.label}
            {!section.available && (
              <span className="ml-auto shrink-0 text-[9.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                Soon
              </span>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function SettingsShell({
  onClose,
  onSectionChange,
  open,
  section,
  sections,
}: SettingsShellProps) {
  const compact = useCompactWindow(COMPACT_WINDOW_BREAKPOINT_PX);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const active = sections.find((candidate) => candidate.id === section && candidate.available);

  useEffect(() => {
    if (!compact) setDrawerOpen(false);
  }, [compact]);

  const selectSection = (id: string) => {
    onSectionChange(id);
    setDrawerOpen(false);
  };

  return (
    <SizeProvider size={compact ? 'compact' : 'default'}>
      <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
        <DialogContent
          aria-label="Settings"
          className="flex h-[min(78vh,640px)] flex-col bg-surface-2"
          presentation="shell"
        >
          <div className="flex h-14 flex-none items-center gap-2 border-b border-border px-5">
            {compact && (
              <Button
                aria-label="Open sections"
                onClick={() => setDrawerOpen(true)}
                ref={menuButtonRef}
                size="icon-compact"
                variant="ghost"
              >
                <Menu aria-hidden="true" className="size-4" />
              </Button>
            )}
            <DialogTitle className="text-[16px]">Settings</DialogTitle>
          </div>

          <div
            className={cn('grid min-h-0 flex-1', compact ? 'grid-cols-1' : 'grid-cols-[190px_1fr]')}
          >
            {!compact && (
              <nav className="overflow-y-auto border-r border-border p-2">
                <SectionsNav activeId={section} onSelect={selectSection} sections={sections} />
              </nav>
            )}
            <div className="min-h-0 overflow-y-auto px-6 py-5">
              {active?.available && active.render()}
            </div>
          </div>
        </DialogContent>

        {compact && (
          <MobileDrawer
            onClose={() => setDrawerOpen(false)}
            open={drawerOpen}
            triggerRef={menuButtonRef}
          >
            <SectionsNav activeId={section} onSelect={selectSection} sections={sections} />
          </MobileDrawer>
        )}
      </Dialog>
    </SizeProvider>
  );
}
