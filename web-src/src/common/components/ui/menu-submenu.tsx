import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { ChevronDownIcon } from "@/common/components/icons"
import { cn } from "@/common/lib/utils"

/**
 * The nested-menu parts of the Menu primitive: a parent row that opens a
 * flyout beside it.
 *
 * Split from `menu.tsx` for the reason `menu-radio.tsx` states: that module
 * is reachable from the eager sidebar, while submenus only ever render
 * behind an interaction boundary, so a sibling file keeps them off the
 * initial chunk.
 */
function MenuSubmenu({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="menu-submenu" {...props} />
}

/**
 * A menu row whose activation is a flyout, not a command. Base UI opens it
 * on hover, ArrowRight, or a non-mouse press — the native menu idiom — so
 * the row's job is to read as "more behind this": the trailing chevron is
 * structural, not decoration, because without it the row is
 * indistinguishable from a choice.
 */
function MenuSubmenuTrigger({ className, children, ...props }: MenuPrimitive.SubmenuTrigger.Props) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="menu-submenu-trigger"
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-inherit outline-none data-disabled:cursor-default data-disabled:opacity-45 data-highlighted:bg-muted data-popup-open:bg-muted",
        className
      )}
      {...props}
    >
      {children}
      {/* 12, matching the Pill's chevron: a direction mark, not an object.
        * The existing down-caret turned in CSS, not a new icons.tsx entry:
        * `icons` is a shared module pinned to the eager chunk, so a
        * right-caret export would bill the initial bundle for a glyph only
        * this lazy surface draws. */}
      <ChevronDownIcon className="size-3 shrink-0 -rotate-90 opacity-75" />
    </MenuPrimitive.SubmenuTrigger>
  )
}

export { MenuSubmenu, MenuSubmenuTrigger }
