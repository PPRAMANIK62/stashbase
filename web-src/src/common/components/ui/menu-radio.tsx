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

/**
 * An independent on/off row inside a menu — same shape as `MenuRadioItem`,
 * different question. A radio row answers "which one of these"; this one
 * answers "is this on", so it carries `menuitemcheckbox` semantics rather
 * than belonging to a group whose other rows are its alternatives.
 *
 * It exists because the alternative for a single boolean is a two-row
 * radio group naming a thing and its own negation, which is more menu than
 * the setting is, and reads as a choice between two features rather than
 * as one feature being on.
 */
function MenuCheckboxItem({
  className,
  children,
  indicator = "check",
  ...props
}: MenuPrimitive.CheckboxItem.Props & {
  /**
   * Which mark carries the on state.
   *
   * `check` is the default and matches the radio rows. `switch` is for the
   * row that would otherwise sit in the SAME popup as a radio list: a check
   * there means "this is the one selected" two rows up and "this is on"
   * down here, one glyph doing two jobs in one card. A track and a thumb
   * cannot be mistaken for a selection.
   */
  indicator?: "check" | "switch"
}) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="menu-checkbox-item"
      className={cn(
        "group/checkbox relative flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent py-1.5 pl-2 text-left text-inherit outline-none",
        indicator === "switch" ? "pr-11" : "pr-8",
        "data-highlighted:bg-muted data-disabled:cursor-default data-disabled:opacity-45",
        className
      )}
      {...props}
    >
      {children}
      <span
        data-slot="menu-checkbox-item-indicator"
        className="pointer-events-none absolute right-2 flex items-center justify-center"
      >
        {indicator === "switch" ? (
          /* Presentational only — the ROW is the control, so this reads the
           * row's own `data-checked` rather than being a second focusable
           * thing inside a menu item. */
          <span
            aria-hidden="true"
            className="flex h-4 w-7 items-center rounded-full border border-input bg-muted transition-tint group-data-checked/checkbox:border-accent group-data-checked/checkbox:bg-accent"
          >
            <span className="size-3 translate-x-0.5 rounded-full bg-background shadow-low transition-control group-data-checked/checkbox:translate-x-3.5" />
          </span>
        ) : (
          <MenuPrimitive.CheckboxItemIndicator>
            <CheckIcon className="size-4 text-accent" />
          </MenuPrimitive.CheckboxItemIndicator>
        )}
      </span>
    </MenuPrimitive.CheckboxItem>
  )
}

export {
  MenuCheckboxItem, MenuGroup, MenuGroupLabel, MenuRadioGroup, MenuRadioItem, MenuSectionLabel,
}
