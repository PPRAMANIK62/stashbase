/** The non-interactive furniture of a Select popup. The caption and the rule
 *  are the shared menu parts built under their select names, so a Select's
 *  furniture reads as `SelectLabel` / `SelectSeparator` in the React tree
 *  while the bodies stay written once; only the group wrapper is particular
 *  to a Select. */
'use client';

import type { HTMLAttributes } from 'react';

import { createMenuParts } from './dropdown-parts';

const { Label: SelectLabel, Separator: SelectSeparator } = createMenuParts('Select', 'listbox');

export { SelectLabel, SelectSeparator };

/** A titled run of options. Pair it with a SelectLabel. */
function SelectGroup({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div role="group" className={className} {...props}>
      {children}
    </div>
  );
}

SelectGroup.displayName = 'SelectGroup';

export { SelectGroup };
