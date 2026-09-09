/** The sidebar's mobile presentation: the shared sliding sheet at the
 *  sidebar's own width, held open through its exit.
 *
 *  The primitive tears its portal down the moment it closes, which would snap
 *  the panel away with no exit, so the dialog is held OPEN through the exit
 *  and the real close only propagates once the spring lands. */

'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { SlidingSheet } from '@/components/internal/sliding-sheet';
import { useSidebarInternals, type SidebarSide } from '@/components/ui/sidebar-context';
import { spring, exitFallbackMs } from '@/lib/springs';

interface SidebarSheetProps {
  side: SidebarSide;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function SidebarSheet({ side, open, onClose, children }: SidebarSheetProps) {
  const { widthMobile } = useSidebarInternals();
  // The panel takes initial focus itself. Left to the primitive, the focus
  // trap lands on the first focusable child — the top nav row — which reads
  // as a selected item the moment the drawer opens, and Chrome grants
  // :focus-visible to script-driven focus so it shows the keyboard ring too.
  const panelRef = useRef<HTMLDivElement | null>(null);

  // `closing` slides the panel offscreen first; only when the spring lands
  // does the real close propagate.
  const [closing, setClosing] = useState(false);
  const visible = open && !closing;

  const finishClose = useCallback(() => {
    setClosing(false);
    onClose();
  }, [onClose]);

  // A parent-driven close (trigger, shortcut, route change) gets the same
  // exit as a primitive-driven one.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) setClosing(true);
    wasOpen.current = open;
  }, [open]);

  // Fallback: rAF-driven animation callbacks stall in throttled tabs.
  useEffect(() => {
    if (!closing) return;
    const id = setTimeout(finishClose, exitFallbackMs(spring.moderate));
    return () => clearTimeout(id);
  }, [closing, finishClose]);

  return (
    <SlidingSheet
      className="flex flex-col overflow-hidden outline-none"
      data={{ 'data-mobile': 'true', 'data-sidebar': 'sidebar' }}
      initialFocus={panelRef}
      label="Sidebar"
      onExit={() => {
        if (closing) finishClose();
      }}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setClosing(true);
      }}
      open={open || closing}
      panelRef={panelRef}
      side={side}
      style={{ width: widthMobile }}
      visible={visible}
    >
      {children}
    </SlidingSheet>
  );
}
