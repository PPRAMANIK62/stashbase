/** DropdownMenu — the popup root and its trigger.
 *
 *  Built on Base UI's Menu primitive, which owns the trigger wiring,
 *  positioning (collision flipping, anchor tracking), dismissal (outside
 *  press, focus-out, Escape), roving highlight, typeahead, and close-on-select.
 *  This root adds only the open state and the deferred unmount that keeps the
 *  popup alive through its exit spring; the popup surface itself is
 *  `./dropdown-content`. */
'use client';

import { Menu } from '@base-ui/react/menu';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { SizeProvider, type SizeVariant } from '@/lib/size-context';
import { spring } from '@/lib/springs';
import { useDeferredUnmount } from '@/lib/use-deferred-unmount';

interface DropdownMenuActions {
  unmount: () => void;
  close: () => void;
}

interface DropdownMenuContextValue {
  open: boolean;
  /** Call from the popup's exit `onAnimationComplete`. */
  releaseOnExit: () => void;
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

export function useDropdownMenuContext(): DropdownMenuContextValue {
  const ctx = useContext(DropdownMenuContext);
  if (!ctx) throw new Error('DropdownMenu compound components must be inside <DropdownMenu>');
  return ctx;
}

interface DropdownMenuProps {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  /** Pins trigger-side content and the portalled popup rows to one step of
   *  the size ladder (default 36px, compact 28px — see /docs/sizes).
   *  Omitted, they follow the surrounding SizeProvider. */
  size?: SizeVariant;
}

function DropdownMenu({
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  size,
}: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp !== undefined ? openProp : internalOpen;
  // The popup stays mounted through its exit spring; see useDeferredUnmount.
  const { actionsRef, releaseOnExit } = useDeferredUnmount<DropdownMenuActions>(open, spring.fast);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );

  const ctx = useMemo(() => ({ open, releaseOnExit }), [open, releaseOnExit]);

  // A size prop pins the whole compound (trigger content + portalled popup —
  // React context crosses portals) to one ladder step.
  const root = (
    <DropdownMenuContext.Provider value={ctx}>
      <Menu.Root
        open={open}
        onOpenChange={handleOpenChange}
        actionsRef={actionsRef}
        disabled={disabled}
        // Non-modal: the page keeps scrolling and the Positioner tracks the
        // anchor, so the popup follows its trigger instead of detaching.
        modal={false}
      >
        {children}
      </Menu.Root>
    </DropdownMenuContext.Provider>
  );

  return size ? <SizeProvider size={size}>{root}</SizeProvider> : root;
}

DropdownMenu.displayName = 'DropdownMenu';

const DropdownTrigger = Menu.Trigger;

export { DropdownMenu, DropdownTrigger };
