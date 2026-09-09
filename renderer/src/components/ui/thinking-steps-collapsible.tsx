/** The two collapsible mechanics the reasoning trace is built from, shared by
 *  its root section and by a step's nested detail body.
 *
 *  `TriggerRow` is the disclosure row: hover wash, a dual-layer label whose
 *  bold copy reserves the width so the weight change never reflows the row,
 *  and a chevron that rotates from right to down.
 *
 *  `CollapsePanel` is the body. The travel is the shared `Collapse`; what
 *  this module adds is the Base UI seam. Base UI's own Panel applies `hidden`
 *  the moment a controlled collapsible closes — it cannot observe a JS-driven
 *  exit — which is `display: none` and would freeze the exit mid-flight. This
 *  one renders through `keepMounted` + `render`, drops Base UI's premature
 *  `hidden`, and sets the attribute itself only once the framer exit has
 *  actually finished, so the trigger's `aria-controls` target stays put
 *  throughout. */

'use client';

import { Collapsible } from '@base-ui/react/collapsible';
import { AnimatePresence, motion } from 'framer-motion';
import { forwardRef, useState, type HTMLAttributes, type ReactNode } from 'react';

import { Collapse } from '@/components/internal/collapse';
import { WeightedLabel } from '@/components/ui/weighted-label';
import { focusRing } from '@/lib/focus-ring';
import { useIcon } from '@/lib/icon-context';
import { useShape } from '@/lib/shape-context';
import { useSize } from '@/lib/size-context';
import { spring, tween } from '@/lib/springs';
import { useIsoLayoutEffect } from '@/lib/use-iso-layout-effect';
import { useMeasuredSize } from '@/lib/use-measured-size';
import { useMotionTier } from '@/lib/use-motion-tier';
import { cn } from '@/lib/utils';

interface TriggerRowProps extends HTMLAttributes<HTMLButtonElement> {
  open: boolean;
  children: ReactNode;
}

/**
 * Trigger row: hover background, dual-layer variable-weight label, and a
 * chevron that rotates from right (closed) to down (open). Mirrors the
 * library's accordion trigger styling.
 */
const TriggerRow = forwardRef<HTMLButtonElement, TriggerRowProps>(
  ({ open, children, className, ...props }, ref) => {
    const ChevronRight = useIcon('chevron-right');
    const shape = useShape();
    const sizeClasses = useSize();
    const [isHovered, setIsHovered] = useState(false);
    const highlighted = open || isHovered;
    const washIn = useMotionTier(tween.fast);
    const washOut = useMotionTier(spring.fast.exit);
    const chevron = useMotionTier(spring.fast);

    return (
      <div
        className="relative w-fit"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <AnimatePresence>
          {isHovered && (
            <motion.div
              className={`absolute inset-0 ${shape.bg} pointer-events-none bg-hover`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: washOut }}
              transition={washIn}
            />
          )}
        </AnimatePresence>
        <Collapsible.Trigger
          ref={ref}
          className={cn(
            `relative z-10 flex items-center gap-2.5 ${shape.item} ${sizeClasses.px} ${
              sizeClasses.variant === 'compact' ? 'py-1.5' : 'py-2'
            } cursor-pointer outline-none select-none`,
            focusRing('focus-visible:ring-offset-0'),
            className,
          )}
          {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          <WeightedLabel
            className={cn('text-left', sizeClasses.text)}
            emphasized={open}
            lit={highlighted}
            trim={false}
          >
            {children}
          </WeightedLabel>

          {/* Chevron — right when collapsed, rotates 90° down when expanded */}
          <motion.span
            className="inline-flex shrink-0 items-center justify-center"
            animate={{ rotate: open ? 90 : 0 }}
            transition={chevron}
          >
            <ChevronRight
              size={sizeClasses.icon}
              strokeWidth={highlighted ? 2 : 1.5}
              className={cn(
                'transition-[color,stroke-width] duration-fast',
                highlighted ? 'text-foreground' : 'text-muted-foreground',
              )}
            />
          </motion.span>
        </Collapsible.Trigger>
      </div>
    );
  },
);
TriggerRow.displayName = 'ThinkingStepsTriggerRow';

interface CollapsePanelProps {
  open: boolean;
  children: ReactNode;
}

/**
 * Collapsible panel: the shared `Collapse` inside Base UI's Panel.
 *
 * Base UI's Panel would apply `hidden` the moment a controlled collapsible
 * closes (it can't observe the JS-driven exit animation), which is
 * `display: none` and would freeze the exit mid-flight. So we render through
 * `keepMounted` + `render`, strip Base UI's premature `hidden`, and only
 * apply the attribute ourselves once the collapse's exit has actually
 * completed. The persistent panel element keeps the trigger ↔ panel ARIA
 * contract intact (the trigger's `aria-controls` id lives on it).
 */
function CollapsePanel({ open, children }: CollapsePanelProps) {
  const sizeClasses = useSize();
  // The travel itself is the shared Collapse: measured pixels rather than
  // `height: "auto"`, and `retarget="snap"` because a panel open at mount
  // receives its first pixel target a commit later — that hand-off must jump,
  // not spring, while a panel opened by a click still springs.
  const content = useMeasuredSize<HTMLDivElement>();

  // Re-measure synchronously (pre-paint) when opening, so the spring's
  // target is the fresh layout height from its first frame.
  const remeasure = content.measure;
  useIsoLayoutEffect(() => {
    if (open) remeasure();
  }, [open, remeasure]);

  const [exitComplete, setExitComplete] = useState(!open);
  if (open && exitComplete) {
    // Reset during render so the panel is un-hidden before the opening
    // animation's first paint.
    setExitComplete(false);
  }

  return (
    <Collapsible.Panel
      keepMounted
      render={(panelProps) => {
        const {
          // Applied too early for our exit animation (see above); we
          // control the attribute ourselves.
          hidden: _baseHidden,
          // Only carries the --collapsible-panel-height/width vars, which
          // stay 'auto' since Base UI never measures JS-driven animations.
          style: _baseStyle,
          ...restPanel
        } = panelProps as React.HTMLAttributes<HTMLDivElement> & {
          hidden?: boolean;
        };
        return (
          <div {...restPanel} hidden={!open && exitComplete}>
            <Collapse
              fade="none"
              height={content.size}
              onExitComplete={() => setExitComplete(true)}
              open={open}
              retarget="snap"
            >
              <div
                ref={content.ref}
                className={cn('px-3 pt-1 pb-3 text-muted-foreground', sizeClasses.text)}
              >
                {children}
              </div>
            </Collapse>
          </div>
        );
      }}
    />
  );
}

export { CollapsePanel, TriggerRow };
