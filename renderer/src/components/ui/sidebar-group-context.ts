/** The context a sidebar group publishes to its own parts.
 *
 *  It lives apart from the components so the group can inspect its children by
 *  element type (`k.type === SidebarGroupLabel`) while the label reads the
 *  group's state, without the two modules importing each other in a circle. */

'use client';

import { createContext } from 'react';

interface SidebarGroupContextValue {
  open: boolean;
  toggle: () => void;
  contentId: string;
  /** How many header action buttons overlay the label's right edge — the
   *  collapsible label pads itself so its chevron clears them. */
  actionsCount: number;
}

/** Present only inside a `collapsible` group; a plain group renders its label
 *  as static text. */
export const SidebarGroupContext = createContext<SidebarGroupContextValue | null>(null);
