/** A sub row's button: the same row treatment as a parent row's, one step
 *  shorter and rendered as an anchor.
 *
 *  Only the height steps down — sub rows keep the parent rows' type size, and
 *  they join the SAME menu scope, so the hover background glides between a
 *  parent and its children without a seam. Its tab-stop rule is simpler than
 *  the parent button's: a sub row is a tab stop only while it is current. */

'use client';

import {
  forwardRef,
  useRef,
  type AnchorHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';

import { MenuRowLabel, RowIcon } from '@/components/ui/sidebar-menu-label';
import { useRowButton } from '@/components/ui/sidebar-menu-row';
import type { IconComponent } from '@/lib/icon-context';
import { mergeRefs } from '@/lib/merge-refs';
import { resolveSlotTemplate, slotElement } from '@/lib/slot-template';
import { cn } from '@/lib/utils';

interface SidebarMenuSubButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  isActive?: boolean;
  /** Convenience shorthand for a single leading glyph, exactly as on
   *  SidebarMenuButton; `children` (or `render`) is the primary path. */
  icon?: IconComponent;
  /** The row's title, named rather than inferred from `children` — see
   *  SidebarMenuButton. `children` carries whatever rides beside it. */
  label?: ReactNode;
  /** Renders the row into this element instead of an `<a>` — a router link,
   *  say. Props, classes and refs merge onto it. */
  render?: ReactElement;
}

const SidebarMenuSubButton = forwardRef<HTMLAnchorElement, SidebarMenuSubButtonProps>(
  ({ isActive = false, icon: Icon, label, render, className, children, ...props }, ref) => {
    const buttonRef = useRef<HTMLAnchorElement | null>(null);
    const { lit, itemShape, compact, iconSize, textClass, gutterVars } = useRowButton(
      buttonRef,
      isActive,
    );
    const { template, content } = resolveSlotTemplate(render, children);

    return slotElement(
      template,
      'a',
      {
        ref: mergeRefs(buttonRef, ref),
        'data-sidebar': 'menu-sub-button',
        'data-active': isActive ? 'true' : undefined,
        'aria-current': isActive ? 'page' : undefined,
        tabIndex: isActive ? 0 : -1,
        className: cn(
          'relative z-10 flex w-full cursor-pointer items-center gap-2 pl-2 text-left outline-none select-none',
          'pr-[var(--row-gutter)] transition-[padding] duration-fast group-focus-within/menu-sub-item:pr-[var(--row-gutter-hover)] group-hover/menu-sub-item:pr-[var(--row-gutter-hover)] group-has-[[data-sidebar=menu-action]:is([data-state=open],[data-popup-open],[aria-expanded=true])]/menu-sub-item:pr-[var(--row-gutter-hover)]',
          compact ? 'h-6' : 'h-7',
          itemShape,
          className,
        ),
        ...props,
        style: { ...gutterVars, ...props.style },
      },
      <>
        {Icon && <RowIcon icon={Icon} lit={lit} size={iconSize} />}
        {/* Sub-rows keep the parent rows' type size — only the row height
            steps down. */}
        <MenuRowLabel
          emphasized={isActive}
          extras={content}
          label={label}
          lit={lit}
          textClass={textClass}
        />
      </>,
    );
  },
);
SidebarMenuSubButton.displayName = 'SidebarMenuSubButton';

export { SidebarMenuSubButton };
