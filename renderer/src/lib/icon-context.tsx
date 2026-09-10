/** The renderer's icon indirection. Every primitive asks for an icon by role
 *  (`chevron-right`, `x`, `check`) instead of importing a lucide component
 *  directly, and `IconProvider` lets a host swap the whole set — or one entry.
 *
 *  `IconName` is the closed vocabulary, and it is closed to what is actually
 *  asked for. It used to list 59 roles with a lucide import each; eleven were
 *  ever requested, and the other forty-eight were a catalogue this renderer
 *  paid for in bundle weight and in the impression that a role existed because
 *  something drew it. Adding a role means adding it here, giving it a default,
 *  and having a caller — in that order. */

'use client';

import {
  ArrowUp,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Dot,
  ImageIcon,
  PanelLeft,
  PanelRight,
  Search,
  X,
} from 'lucide-react';
import { createContext, useContext, useMemo, type ComponentType, type ReactNode } from 'react';

export interface IconComponentProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export type IconComponent = ComponentType<IconComponentProps>;

export type IconName =
  | 'arrow-up'
  | 'brain'
  | 'check'
  | 'chevron-down'
  | 'chevron-right'
  | 'dot'
  | 'image'
  | 'panel-left'
  | 'panel-right'
  | 'search'
  | 'x';

const defaultIcons: Record<IconName, IconComponent> = {
  'arrow-up': ArrowUp,
  brain: Brain,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  dot: Dot,
  image: ImageIcon,
  'panel-left': PanelLeft,
  'panel-right': PanelRight,
  search: Search,
  x: X,
};

const IconContext = createContext<Record<IconName, IconComponent> | null>(null);

/**
 * Returns a single icon component for the given name.
 * Falls back to the default (Lucide) set if no provider is present.
 */
function useIcon(name: IconName): IconComponent {
  const icons = useContext(IconContext);
  return (icons ?? defaultIcons)[name];
}

/**
 * Swap some or all icons for components from another library.
 * Names left out of `icons` keep their default (Lucide) component.
 */
function IconProvider({
  children,
  icons,
}: {
  children: ReactNode;
  icons?: Partial<Record<IconName, IconComponent>>;
}) {
  const value = useMemo(() => ({ ...defaultIcons, ...icons }), [icons]);
  return <IconContext.Provider value={value}>{children}</IconContext.Provider>;
}

export { IconProvider, useIcon };
