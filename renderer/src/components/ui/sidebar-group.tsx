/** A titled section of the sidebar, optionally a group-level accordion.
 *
 *  `collapsible` turns the group's label into the toggle and folds everything
 *  rendered after it (header actions excepted) into a measured-height
 *  collapse. The measured height — never `auto`, which framer measures wrong
 *  under a scaled ancestor — is what makes a group nest safely inside another
 *  animating region; the toggling guard below is what stops this wrapper from
 *  chasing a nested sub-menu's own collapse with a second spring. */

'use client';

import {
  forwardRef,
  isValidElement,
  useCallback,
  useId,
  useMemo,
  useState,
  Children,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { Collapse } from '@/components/internal/collapse';
import { SidebarGroupContext } from '@/components/ui/sidebar-group-context';
import { SidebarGroupLabel } from '@/components/ui/sidebar-group-label';
import { useMeasuredSize } from '@/lib/use-measured-size';
import { cn } from '@/lib/utils';

type SidebarGroupSectionProps = HTMLAttributes<HTMLDivElement>;

interface SidebarGroupProps extends SidebarGroupSectionProps {
  /** Makes the group's SidebarGroupLabel a toggle that collapses everything
   *  rendered after it — a group-level accordion. Uncontrolled by default;
   *  pass `open`/`onOpenChange` to control it. */
  collapsible?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Buttons that overlay the label row's right end, at the rows' own 24px
   *  action size. The label reserves room for them, so a long section name
   *  truncates before it reaches them rather than running underneath. A
   *  collapsible group only: a plain group's label is static text, and an
   *  action beside it would have no row of its own to sit on. */
  headerActions?: ReactNode;
}

const SidebarGroup = forwardRef<HTMLDivElement, SidebarGroupProps>(
  (
    {
      className,
      collapsible = false,
      open: openProp,
      defaultOpen = true,
      onOpenChange,
      headerActions,
      children,
      ...props
    },
    ref,
  ) => {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const open = openProp ?? uncontrolledOpen;
    const contentId = useId();
    const toggle = useCallback(() => {
      const next = !(openProp ?? uncontrolledOpen);
      setUncontrolledOpen(next);
      onOpenChange?.(next);
    }, [openProp, uncontrolledOpen, onOpenChange]);
    const content = useMeasuredSize<HTMLDivElement>({ acceptZero: true });

    // The label stays put; everything after it rides in the collapse wrapper.
    // If no SidebarGroupLabel child is found the group renders untouched.
    let inner: ReactNode = children;
    if (collapsible) {
      const kids = Children.toArray(children);
      const labelIdx = kids.findIndex((k) => isValidElement(k) && k.type === SidebarGroupLabel);
      if (labelIdx !== -1) {
        const rest = kids.slice(labelIdx + 1);
        inner = (
          <>
            {kids.slice(0, labelIdx)}
            {/* Header hover scope: hovering anywhere on the row reveals the
                label's chevron, including the parts of the row the label
                element itself never :hovers. It is also what the actions
                overlay, so they must not be nested inside the label: the
                label is the toggle button, and a button inside a button is
                neither valid nor clickable. right-1.5 puts the last box's
                centre 18px in from the row's edge, the axis the folder
                header's actions and a tree row's trailing action both keep. */}
            <div className="group/group-header relative w-full">
              {kids[labelIdx]}
              {headerActions && (
                <div className="absolute inset-y-0 right-1.5 flex items-center gap-1">
                  {headerActions}
                </div>
              )}
            </div>
            <Collapse
              height={content.size}
              hideWhenClosed
              id={contentId}
              open={open}
              retarget="snap"
              unclipWhenSettled
            >
              <div ref={content.ref} className="flex w-full min-w-0 flex-col">
                {rest}
              </div>
            </Collapse>
          </>
        );
      }
    }

    // How much trailing room the label pads out, published rather than
    // counted twice: the cluster above and the label's reservation have to
    // agree, and only the group can see both.
    const actionsCount = Children.count(headerActions);
    const ctx = useMemo(
      () => ({ open, toggle, contentId, actionsCount }),
      [open, toggle, contentId, actionsCount],
    );

    return (
      <div
        ref={ref}
        data-sidebar="group"
        data-state={collapsible ? (open ? 'open' : 'closed') : undefined}
        className={cn('relative flex w-full min-w-0 flex-col p-2', className)}
        {...props}
      >
        <SidebarGroupContext.Provider value={collapsible ? ctx : null}>
          {inner}
        </SidebarGroupContext.Provider>
      </div>
    );
  },
);
SidebarGroup.displayName = 'SidebarGroup';

const SidebarGroupContent = forwardRef<HTMLDivElement, SidebarGroupSectionProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-sidebar="group-content" className={cn('w-full', className)} {...props} />
  ),
);
SidebarGroupContent.displayName = 'SidebarGroupContent';

export { SidebarGroup, SidebarGroupContent };
