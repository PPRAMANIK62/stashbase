/** The scrimmed panel that slides in from a screen edge — the mobile drawer
 *  and the sidebar's mobile sheet are the same surface at different widths.
 *
 *  Built on Base UI Dialog rather than Base UI Drawer: Drawer's
 *  swipe-to-dismiss writes inline `transform` + `--drawer-swipe-movement-*`
 *  CSS vars onto its Popup and expects CSS-transition choreography (plus a
 *  mandatory <Drawer.Viewport>), which fights framer-motion's transform
 *  management on the same element. Dialog provides everything actually needed
 *  — scroll lock (scrollbar-gap safe, blocks iOS touch scrolling), focus trap,
 *  focus restore timed after close, Esc + outside-click dismissal — while
 *  leaving the slide to framer-motion.
 *
 *  The primitive would tear its portal down the moment the dialog closes,
 *  which snaps the panel away with no exit, so `open` and `visible` are two
 *  questions here: the root stays open while the panel is already travelling
 *  out. How that is held — a deferred unmount or a closing flag — belongs to
 *  the caller, which is also who hears `onExit`. */

'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { motion, type MotionStyle } from 'framer-motion';
import type { HTMLAttributes, ReactNode, Ref, RefObject } from 'react';

import { motionSafeProps, type MotionSafeDivProps } from '@/components/internal/sidebar-motion';
import { motionStyle } from '@/lib/local/motion-style';
import { mergeRefs } from '@/lib/merge-refs';
import { spring, tween } from '@/lib/springs';
import { surfaceClasses } from '@/lib/surface-classes';
import { useSurface, SurfaceProvider } from '@/lib/surface-context';
import { useMotionTier } from '@/lib/use-motion-tier';
import { cn } from '@/lib/utils';

interface SlidingSheetProps {
  /** The primitive's own open state: true for as long as the portal must stay
   *  mounted, which includes the exit. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether the sheet is showing. False while it plays its exit. */
  visible: boolean;
  /** The edge the panel is anchored to and travels from. */
  side: 'left' | 'right';
  /** The panel's accessible name. */
  label: string;
  children: ReactNode;
  /** Width, padding and the panel's own scrolling. */
  className?: string;
  style?: MotionStyle;
  /** Attributes the caller's own structural queries select on. */
  data?: Record<string, string>;
  actionsRef?: RefObject<DialogPrimitive.Root.Actions | null> | undefined;
  initialFocus?: RefObject<HTMLElement | null> | undefined;
  finalFocus?: RefObject<HTMLElement | null> | undefined;
  panelRef?: Ref<HTMLDivElement> | undefined;
  /** Fired when the panel's travel lands, in either direction. This is where
   *  a caller holding the root open through the exit lets go of it. */
  onExit: () => void;
}

export function SlidingSheet({
  actionsRef,
  children,
  className,
  data,
  finalFocus,
  initialFocus,
  label,
  onExit,
  onOpenChange,
  open,
  panelRef,
  side,
  style,
  visible,
}: SlidingSheetProps) {
  const substrate = useSurface();
  const level = Math.min(substrate + 2, 8);
  // Reduced motion drops the slide (the movement) but keeps the scrim's
  // opacity fade — the state change stays legible without the travel.
  const settle = useMotionTier(spring.moderate);
  const retract = useMotionTier(spring.moderate.exit);
  const offscreen = side === 'left' ? '-100%' : '100%';

  return (
    <DialogPrimitive.Root actionsRef={actionsRef} open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Scrim: the shared --scrim token, so system-dark users get the
            heavier wash without an explicit .dark class on <html>. */}
        <DialogPrimitive.Backdrop
          render={(backdropProps) => (
            <motion.div
              {...motionSafeProps(backdropProps as HTMLAttributes<HTMLDivElement>)}
              className="fixed inset-0 z-40 bg-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: visible ? 1 : 0 }}
              transition={visible ? tween.base : spring.moderate.exit}
            />
          )}
        />

        <DialogPrimitive.Popup
          aria-label={label}
          finalFocus={finalFocus}
          initialFocus={initialFocus}
          render={(popupProps) => {
            const {
              style: baseStyle,
              ref: baseRef,
              ...rest
            } = popupProps as HTMLAttributes<HTMLDivElement> & {
              ref?: React.Ref<HTMLDivElement>;
            };
            return (
              <motion.div
                {...(rest as MotionSafeDivProps)}
                {...data}
                // Merge, don't replace: the primitive needs its own handle on
                // the panel as much as initialFocus needs the caller's.
                ref={mergeRefs(panelRef, baseRef)}
                tabIndex={-1}
                data-side={side}
                className={cn(
                  'fixed inset-y-0 z-50',
                  side === 'left' ? 'left-0' : 'right-0',
                  !visible && 'pointer-events-none',
                  surfaceClasses(level, 3),
                  className,
                )}
                style={{ ...motionStyle(baseStyle), ...style }}
                initial={{ x: offscreen }}
                // spring.moderate: critically damped, so the panel decelerates
                // into x: 0 without overshooting and exposing the page behind
                // its leading edge.
                animate={{ x: visible ? 0 : offscreen }}
                transition={visible ? settle : retract}
                onAnimationComplete={onExit}
              >
                <SurfaceProvider value={level}>{children}</SurfaceProvider>
              </motion.div>
            );
          }}
        />
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
