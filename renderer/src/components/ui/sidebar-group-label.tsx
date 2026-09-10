/** A section header. Static text on its own; inside a `collapsible` group it
 *  becomes the group's toggle without changing its design treatment — hover
 *  only raises the label's contrast and reveals a chevron, which stays visible
 *  while collapsed as the reopen cue.
 *
 *  Only the leading text truncates: element children (count badges, trailing
 *  controls) stay flex siblings so the row's gap keeps spacing them — the same
 *  split a menu row's label does. */

'use client';

import { motion } from 'framer-motion';
import {
  forwardRef,
  useContext,
  Children,
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';

import { SidebarGroupContext } from '@/components/ui/sidebar-group-context';
import { FOCUS_RING } from '@/lib/focus-ring';
import { useIcon } from '@/lib/icon-context';
import { useShape } from '@/lib/shape-context';
import { useSize } from '@/lib/size-context';
import { resolveSlotTemplate, slotElement } from '@/lib/slot-template';
import { spring } from '@/lib/springs';
import { useMotionTier } from '@/lib/use-motion-tier';
import { cn } from '@/lib/utils';

/** Splits the leading string run out so it alone truncates, leaving element
 *  children as siblings the row's gap can space. */
function splitLeadingText(content: ReactNode): ReactNode {
  const nodes = Children.toArray(content);
  let textEnd = 0;
  while (
    textEnd < nodes.length &&
    (typeof nodes[textEnd] === 'string' || typeof nodes[textEnd] === 'number')
  ) {
    textEnd++;
  }
  const leadingText = nodes.slice(0, textEnd).join('');
  if (!leadingText) return content;
  return (
    <>
      <span className="min-w-0 truncate">{leadingText}</span>
      {nodes.slice(textEnd)}
    </>
  );
}

interface SidebarGroupLabelProps extends HTMLAttributes<HTMLDivElement> {
  render?: ReactElement;
}

const SidebarGroupLabel = forwardRef<HTMLDivElement, SidebarGroupLabelProps>(
  ({ className, render, children, ...props }, ref) => {
    const sizeClasses = useSize();
    const group = useContext(SidebarGroupContext);
    const shape = useShape();
    const ChevronRightIcon = useIcon('chevron-right');
    const pivot = useMotionTier(spring.fast);
    const { template, content } = resolveSlotTemplate(render, children);
    const labelContent = splitLeadingText(content);

    if (group) {
      return slotElement(
        template,
        'button',
        {
          ref: ref as Ref<HTMLElement>,
          type: template ? undefined : 'button',
          'data-sidebar': 'group-label',
          'aria-expanded': group.open,
          'aria-controls': group.contentId,
          onClick: group.toggle,
          // The action cluster overlays the label's right edge, so the label
          // pads past it — far enough that the hover-revealed chevron lands
          // one cluster gap (4px) to its left and the whole trailing run
          // keeps a single rhythm. Cluster width is 24px per action plus 4px
          // between them; add that gap again, less the 8px the group's
          // padding already gives back: 28n + 6. The cluster is always
          // visible, so the reservation is permanent.
          style:
            group.actionsCount > 0
              ? ({ '--group-actions-pad': `${group.actionsCount * 28 + 6}px` } as CSSProperties)
              : undefined,
          className: cn(
            'flex h-8 w-full shrink-0 cursor-pointer items-center gap-2 px-2 text-left text-muted-foreground/70 outline-none select-none',
            'transition-colors duration-fast hover:text-muted-foreground',
            group.actionsCount > 0 && 'pr-[var(--group-actions-pad)]',
            FOCUS_RING,
            shape.item,
            sizeClasses.caption,
            className,
          ),
          ...props,
        },
        <>
          {labelContent}
          {/* The chevron occupies an action-sized box, so it reads as one more
              icon in the row rather than a smaller glyph tacked on the end.
              One chevron-right glyph for both states, sprung 90° to point
              down while the group is open — the motion wrapper is what
              animates: Tailwind's rotate-* sets the standalone CSS `rotate`
              property, which transition-transform never covers. While open
              the whole box collapses to zero width at rest so the label text
              keeps the full row; hover/focus (or an open action popup)
              reveals it. Collapsed keeps it visible as the reopen cue. */}
          {/* No width/opacity transition: animating the box's width slides
              the glyph in from the side — the chevron should simply be
              there once the header is hovered. */}
          <span
            className={cn(
              'ml-auto flex h-6 shrink-0 items-center justify-center overflow-hidden',
              group.open
                ? 'w-0 opacity-0 group-focus-within/group-header:w-6 group-focus-within/group-header:opacity-100 group-hover/group-header:w-6 group-hover/group-header:opacity-100 group-has-[[data-sidebar=group-action]:is([data-state=open],[data-popup-open],[aria-expanded=true])]/group-header:w-6 group-has-[[data-sidebar=group-action]:is([data-state=open],[data-popup-open],[aria-expanded=true])]/group-header:opacity-100 pointer-coarse:w-6 pointer-coarse:opacity-100'
                : 'w-6 opacity-100',
            )}
          >
            <motion.span
              className="inline-flex"
              animate={{ rotate: group.open ? 90 : 0 }}
              transition={pivot}
            >
              <ChevronRightIcon size={sizeClasses.icon} strokeWidth={1.5} className="shrink-0" />
            </motion.span>
          </span>
        </>,
      );
    }

    return slotElement(
      template,
      'div',
      {
        ref: ref as Ref<HTMLElement>,
        'data-sidebar': 'group-label',
        className: cn(
          'flex h-8 shrink-0 items-center gap-2 px-2 text-muted-foreground/70 outline-none',
          sizeClasses.caption,
          className,
        ),
        ...props,
      },
      labelContent,
    );
  },
);
SidebarGroupLabel.displayName = 'SidebarGroupLabel';

export { SidebarGroupLabel };
