import type { ComponentProps } from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { CheckIcon } from "@/common/components/icons"
import { cn } from "@/common/lib/utils"

/**
 * The grouping and single-choice parts of the Menu primitive.
 *
 * Split from `menu.tsx` for bundle reasons only — see the note there. Use
 * them exactly as if they were exported from it.
 */

/**
 * A quiet label grouping the rows under it ("Folders", "Recent"). Not
 * `MenuGroupLabel`: that one is Base UI's accessible name for a real
 * `MenuGroup` and needs the group around it, while this is a plain visual
 * divider for a flat list of items.
 *
 * A label rather than a `MenuSeparator`, because a hairline directly under
 * the default row cuts a menu in half and reads as two menus; a muted line
 * of text groups the list without claiming that much. `presentation` keeps
 * it out of the menu's own item count.
 */
function MenuSectionLabel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="menu-section-label"
      role="presentation"
      className={cn("px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  )
}

/** A titled run of items inside one popup. */
function MenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="menu-group" {...props} />
}

function MenuGroupLabel({ className, ...props }: MenuPrimitive.GroupLabel.Props) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="menu-group-label"
      className={cn(
        "px-2 pt-1.5 pb-1 text-xs font-semibold text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

/**
 * A one-of-many choice inside a menu.
 *
 * This is the part the agent panel's composer pills were drawing by hand:
 * rows of `<button>` with a hand-managed check glyph, inside a popover that
 * announced itself as nothing in particular. Base UI gives the group
 * `role="menu"`, each row `role="menuitemradio"` with its own checked
 * state, plus arrow keys and typeahead — none of which a div of buttons has.
 */
function MenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return <MenuPrimitive.RadioGroup data-slot="menu-radio-group" {...props} />
}

function MenuRadioItem({ className, children, ...props }: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="menu-radio-item"
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent py-1.5 pr-8 pl-2 text-left text-inherit outline-none",
        "data-highlighted:bg-muted data-disabled:cursor-default data-disabled:opacity-45",
        className
      )}
      {...props}
    >
      {children}
      <span
        data-slot="menu-radio-item-indicator"
        className="pointer-events-none absolute right-2 flex items-center justify-center"
      >
        {/* 16px: the size `ManagedMenu` gives both its leading icon slot and
          * its own check — one menu row shape, one glyph step. */}
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon className="size-4 text-accent" />
        </MenuPrimitive.RadioItemIndicator>
      </span>
    </MenuPrimitive.RadioItem>
  )
}

export { MenuGroup, MenuGroupLabel, MenuRadioGroup, MenuRadioItem, MenuSectionLabel }
