/** The region half of a disclosure: content that opens and closes under a
 *  trigger the caller owns.
 *
 *  The travel is the kit's one measured collapse, with the measurement taken
 *  here — a product surface says what is open and hands over its content,
 *  rather than wiring a ref, a ResizeObserver, and a pixel height at every
 *  site that wants a section to fold. The internal part stays internal for
 *  the wrappers that must measure something other than their own child (the
 *  composer's strips read their clipping parent, a sub-menu accepts a zero
 *  height, a nested section snaps rather than springs); everything else
 *  installs this.
 *
 *  The trigger is not here on purpose. A disclosure's control is a row, a
 *  button, or a chevron beside a name, and those look nothing alike across
 *  the app; what they share is the box beneath them, which is this. Give the
 *  control `aria-expanded` and point its `aria-controls` at `id`. */

'use client';

import { useId, type ReactNode } from 'react';

import { Collapse } from '@/components/internal/collapse';
import { useMeasuredSize } from '@/lib/use-measured-size';

export interface DisclosureProps {
  children: ReactNode;
  /** Classes for the content inside the clipping box. The box itself takes
   *  none: it owns only the height. */
  className?: string;
  /** Names the region for the trigger's `aria-controls`. */
  id?: string | undefined;
  open: boolean;
  /** `unmount` (the default) takes the content out of the tree once the close
   *  lands: nothing costly stays mounted behind a closed region and nothing
   *  inside it can be reached by tab. `keep` leaves it at height zero, for a
   *  region whose `aria-controls` target must stay put or that holds focus to
   *  restore. Note that a kept region still takes the gap a flex or grid
   *  parent puts around its children. */
  presence?: 'keep' | 'unmount' | undefined;
}

export function Disclosure({
  children,
  className,
  id,
  open,
  presence = 'unmount',
}: DisclosureProps) {
  // Minted here rather than taken from `id`, which is optional and which a
  // caller may reuse across regions; AnimatePresence needs one key per box.
  const regionKey = useId();
  const content = useMeasuredSize<HTMLDivElement>();
  return (
    <Collapse
      // Spread rather than passed: the box's `id` is optional, and under
      // exact optional types an explicit `undefined` is not the same as absent.
      {...(id === undefined ? {} : { id })}
      height={content.size}
      hideWhenClosed={presence === 'keep'}
      open={open}
      presence={presence}
      regionKey={regionKey}
    >
      <div className={className} ref={content.ref}>
        {children}
      </div>
    </Collapse>
  );
}
