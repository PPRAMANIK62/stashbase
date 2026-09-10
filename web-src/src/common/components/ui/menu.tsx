import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { cn } from "@/common/lib/utils"

/* The grouping and single-choice parts live in `menu-radio.tsx`. They are
 * one primitive conceptually, but this module is reachable from the eager
 * sidebar while those parts are only ever used behind an interaction
 * boundary — keeping them in a sibling file is what stops them being
 * charged to the initial chunk (scripts/check-renderer-chunks.mjs). */
function Menu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="menu" {...props} />
}

function MenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="menu-trigger" {...props} />
}

function MenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="menu-portal" {...props} />
}

function MenuPositioner({ className, ...props }: MenuPrimitive.Positioner.Props) {
  return (
    <MenuPrimitive.Positioner
      data-slot="menu-positioner"
      // Above the modal veils (z-menu): the menu portals to <body>, so a
      // lower value leaves it stacked BEHIND whatever opened it whenever
      // the trigger lives inside a veil — the search popup's scope pill
      // did exactly that. Tooltips and toasts sit above it; see the layer
      // ramp in globals.css.
      className={cn("z-menu", className)}
      {...props}
    />
  )
}

function MenuPopup({ className, ...props }: MenuPrimitive.Popup.Props) {
  return (
    <MenuPrimitive.Popup
      data-slot="menu-popup"
      className={cn(
        // Origin-aware: Base UI resolves --transform-origin to the corner the
        // popup actually landed on after collision handling, so the menu
        // grows out of the control that opened it instead of inflating from
        // its own middle. It starts at 96%, never at 0 — nothing in the
        // world appears from nothing, and a menu that does reads as a glitch.
        //
        // The exit is one role step QUICKER than the entrance (fast 120ms in,
        // instant 100ms out). Opening is the app answering a request and can
        // afford to be seen; closing is the request already granted, and a
        // symmetric exit leaves the menu hanging over whatever the user
        // pressed next.
        "flex min-w-44 flex-col gap-px rounded-xl border border-border bg-popover p-1 text-base text-popover-foreground shadow-elevation outline-none origin-anchor transition-surface data-[starting-style]:scale-96 data-[starting-style]:opacity-0 data-[ending-style]:scale-96 data-[ending-style]:opacity-0 data-[ending-style]:duration-instant",
        className
      )}
      {...props}
    />
  )
}

function MenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      className={cn(
        "flex w-full cursor-pointer items-center justify-between gap-4 rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-inherit outline-none data-disabled:cursor-default data-disabled:opacity-45 data-highlighted:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function MenuSubmenuRoot({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="menu-submenu-root" {...props} />
}

/* A submenu trigger IS an item (same row anatomy and highlight); Base UI
 * adds the hover/arrow-key open behavior and keeps the PARENT menu on
 * screen while the child is up — the whole point of a cascade.
 *
 * ATTACHED ROOTS ONLY: Base UI's detached-trigger support is
 * top-level-only, so a SubmenuRoot under ManagedMenu's virtual-anchor
 * root registers with a null floating-tree parent and the parent closes
 * itself with reason `sibling-open` the moment the child opens. Menus
 * that need a cascade must be composed with a real `MenuTrigger` (the
 * folder header's ⋯ menu is the standing example). */
function MenuSubmenuTrigger({ className, ...props }: MenuPrimitive.SubmenuTrigger.Props) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="menu-submenu-trigger"
      className={cn(
        "flex w-full cursor-pointer items-center justify-between gap-4 rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-inherit outline-none data-disabled:cursor-default data-disabled:opacity-45 data-highlighted:bg-muted data-[popup-open]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function MenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="menu-separator"
      className={cn("mx-1.5 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

export {
  Menu,
  MenuItem,
  MenuPopup,
  MenuPortal,
  MenuPositioner,
  MenuSeparator,
  MenuSubmenuRoot,
  MenuSubmenuTrigger,
  MenuTrigger,
}
