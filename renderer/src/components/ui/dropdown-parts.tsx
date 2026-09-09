/** The non-interactive furniture of a menu surface: a group caption and a
 *  rule between groups. Written once and built under the dropdown and select
 *  names, because a caption in a Select popup and a caption in a Dropdown
 *  popup are the same element with the same type role — the two copies this
 *  replaces had drifted apart only in their file.
 *
 *  `createMenuParts` builds the pair rather than exporting one shared instance
 *  so each surface's rows carry that surface's name in the React tree: a
 *  Select's caption reads `SelectLabel`, a Dropdown's `DropdownLabel`. The
 *  bodies stay written once; only the identity differs. */
'use client';

import {
  forwardRef,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type RefAttributes,
} from 'react';

import { useSize } from '@/lib/size-context';
import { cn } from '@/lib/utils';

type MenuPart = ForwardRefExoticComponent<
  HTMLAttributes<HTMLDivElement> & RefAttributes<HTMLDivElement>
>;

interface MenuParts {
  /** The caption above a group of rows. */
  Label: MenuPart;
  /** The rule between two groups of rows. */
  Separator: MenuPart;
}

/** The ARIA role of the surface these parts furnish. It decides one thing:
 *  whether the rule between groups is announced. `menu` owns `separator`;
 *  `listbox` owns only `option` and `group`, so a rule inside a Select popup
 *  is decoration and saying otherwise makes the popup itself invalid. The
 *  division a screen reader hears there comes from the group above it. */
type MenuPartsOwner = 'menu' | 'listbox';

/** Builds one surface's caption and rule, named after that surface. */
export function createMenuParts(surface: string, owner: MenuPartsOwner): MenuParts {
  const Label: MenuPart = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => {
      // Group labels are the caption role of the type scale — see /docs/sizes.
      const sizeClasses = useSize();
      return (
        <div
          ref={ref}
          className={cn(
            'shrink-0 px-2 py-1.5 text-muted-foreground',
            sizeClasses.caption,
            className,
          )}
          {...props}
        />
      );
    },
  );
  Label.displayName = `${surface}Label`;

  // Negative inline margins bleed the rule to the surface's edge past the
  // panel padding.
  const Separator: MenuPart = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
      <div
        ref={ref}
        {...(owner === 'menu' ? { role: 'separator' } : { 'aria-hidden': true })}
        className={cn('-mx-1 my-1 h-px shrink-0 bg-border/60', className)}
        {...props}
      />
    ),
  );
  Separator.displayName = `${surface}Separator`;

  return { Label, Separator };
}

const { Label: MenuLabel, Separator: MenuSeparator } = createMenuParts('Dropdown', 'menu');

export { MenuLabel, MenuSeparator };
