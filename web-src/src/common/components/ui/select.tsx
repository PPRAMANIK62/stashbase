import type { ReactNode } from 'react';
import { Select as SelectPrimitive } from '@base-ui/react/select';

import { CheckIcon, ChevronDownIcon } from '@/common/components/icons';
import { cn } from '@/common/lib/utils';

/**
 * A one-of-many choice, on Base UI rather than the native `<select>`.
 *
 * The native control was a deliberate choice once — the OS popup handles
 * collision, keyboard and accessibility for free — and the cost was that
 * one control in the app could not be styled at all. A native popup paints
 * in the OS palette, so it ignored the app's theme entirely: every other
 * surface followed `data-theme` and the six selects did not, which is most
 * visible as a light popup dropping out of a dark app. It also could not
 * take the corner, the focus halo, the entrance motion, or the layer ramp
 * that the rest of this layer now shares, and the caret had to be faked
 * with an `appearance-none` box and an absolutely-positioned chevron on a
 * wrapper span (`AgentDebugSelect`), which is the tell that the control was
 * already being fought rather than used.
 *
 * Base UI supplies what the native element was being kept for: `listbox`
 * semantics with `option` rows, typeahead, Home/End, arrow keys, and
 * collision-aware positioning.
 *
 * DATA-DRIVEN, not the shadcn part set. Every select in this app is a flat
 * list of value/label pairs — no groups, no icons, no per-row detail — and
 * splitting that into Trigger/Content/Item parts would make each of the six
 * call sites spell the same four-element skeleton and then map its options
 * inside it. It would also make the label the trigger shows and the rows
 * the popup lists two separate expressions of one array: Base UI resolves
 * the closed trigger's label from `items` (the popup is unmounted, so its
 * rows cannot answer), so the parts version has to pass the array twice and
 * can drift. One `items` prop, used for both, cannot. If a grouped or
 * decorated select ever lands, export the parts then and let this compose
 * them — not before.
 */
export interface SelectOption<Value extends string> {
  value: Value;
  label: ReactNode;
  disabled?: boolean;
}

function Select<Value extends string>({
  items,
  value,
  onValueChange,
  className,
  contentClassName,
  placeholder,
  ...props
}: Omit<
  SelectPrimitive.Root.Props<Value>,
  'items' | 'value' | 'onValueChange' | 'children'
> & {
  items: readonly SelectOption<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
  /** Classes for the closed control. Callers spend this on width. */
  className?: string;
  /** Classes for the popup — a wider list, a taller scroller. */
  contentClassName?: string;
  placeholder?: ReactNode;
}) {
  return (
    <SelectPrimitive.Root
      // `items` is what lets the CLOSED trigger name its value: the popup
      // is unmounted, so Base UI cannot read the label off a row.
      items={items as SelectPrimitive.Root.Props<Value>['items']}
      value={value}
      onValueChange={(next) => onValueChange(next as Value)}
      {...props}
    >
      <SelectPrimitive.Trigger
        data-slot="select"
        // The Input primitive's box at the compact row height, so a select
        // and a text field in the same form read as one family. `h-8`, not
        // Input's `h-9`: this control sits in dense settings rows.
        className={cn(
          'inline-flex h-8 cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none',
          'transition-tint hover:bg-muted',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          'data-disabled:pointer-events-none data-disabled:opacity-50',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} className="truncate" />
        <SelectPrimitive.Icon
          // 12, the disclosure step the Pill's chevron takes — a caret is a
          // direction, not an object.
          render={<ChevronDownIcon className="size-3 shrink-0 opacity-75" />}
        />
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner
          data-slot="select-positioner"
          // A plain dropdown under the trigger, like every other popup in
          // the app. Base UI's default aligns the popup so the SELECTED row
          // lands over the trigger (the macOS native behaviour), which
          // overlays the control, needs the scroll-arrow parts to stay
          // reachable, and is the one popup grammar nothing else here uses.
          alignItemWithTrigger={false}
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="z-menu"
        >
          <SelectPrimitive.Popup
            data-slot="select-content"
            // Same surface and entrance as MenuPopup and PopoverContent:
            // grow from the anchor at 96%, leave one role step quicker.
            className={cn(
              'max-h-overlay-md min-w-36 overflow-y-auto overscroll-contain rounded-lg border border-border bg-popover p-1 text-base text-popover-foreground shadow-elevation outline-none',
              'scrollbar-quiet origin-anchor transition-surface',
              'data-[starting-style]:scale-96 data-[starting-style]:opacity-0',
              'data-[ending-style]:scale-96 data-[ending-style]:opacity-0',
              'data-[ending-style]:duration-instant',
              contentClassName,
            )}
          >
            {items.map((item) => (
              <SelectPrimitive.Item
                key={item.value}
                value={item.value}
                disabled={item.disabled}
                data-slot="select-item"
                className={cn(
                  'relative flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm text-foreground outline-none select-none',
                  'data-highlighted:bg-muted',
                  'data-disabled:pointer-events-none data-disabled:opacity-50',
                )}
              >
                <SelectPrimitive.ItemText className="truncate">{item.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center">
                  <CheckIcon className="size-4 text-accent" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export { Select };
