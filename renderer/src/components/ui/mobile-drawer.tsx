'use client';

import type { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { type ReactNode, type RefObject } from 'react';

import { SlidingSheet } from '@/components/internal/sliding-sheet';
import { spring } from '@/lib/springs';
import { useDeferredUnmount } from '@/lib/use-deferred-unmount';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  triggerRef?: RefObject<HTMLElement | null>;
}

export function MobileDrawer({ open, onClose, children, triggerRef }: MobileDrawerProps) {
  // The portal stays mounted until the panel's exit tween has played; the
  // longest exit here is spring.moderate.exit (the backdrop), so that is the
  // tier the fallback timer tracks. See useDeferredUnmount.
  const { actionsRef, releaseOnExit } = useDeferredUnmount<DialogPrimitive.Root.Actions>(
    open,
    spring.moderate,
  );

  return (
    <SlidingSheet
      actionsRef={actionsRef}
      className="w-64 overflow-y-auto p-4"
      finalFocus={triggerRef}
      label="Navigation"
      onExit={releaseOnExit}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      open={open}
      side="left"
      visible={open}
    >
      {children}
    </SlidingSheet>
  );
}
