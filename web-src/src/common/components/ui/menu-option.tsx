import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { CheckIcon } from "@/common/components/icons"
import { MenuItem } from "@/common/components/ui/menu"
import { cn } from "@/common/lib/utils"

/**
 * The row a `Pill` opens onto: a CHOICE, not a command.
 *
 * A command row is one line of text that does something. A choice row has
 * to answer three questions at once — what is this, what does picking it
 * mean, and is it the one in force — so it carries a leading glyph, a title
 * with a line of detail under it, and a trailing check. Every pill menu in
 * the app is that same list with different options, which is why the shape
 * is a component and not seven class names the two call sites both had to
 * spell in the same order.
 *
 * `MenuOptionContent` is the row's BODY on its own, for the menus whose
 * container is `MenuRadioItem`. Base UI's radio item already owns the row
 * surface, its checked state, and its own check glyph, so composing the
 * full `MenuOption` there would draw the check twice.
 */
function MenuOptionContent({
  icon: Icon,
  title,
  description,
}: {
  /** The row's leading glyph, passed as the component rather than an
   * element so the row sizes it — 16, the menu-row glyph step. */
  icon?: React.ComponentType<{ className?: string }>
  title: React.ReactNode
  description?: React.ReactNode
}) {
  return (
    <>
      {Icon && <Icon className="mt-px size-4 shrink-0 text-muted-foreground" />}
      {/* `min-w-0` again, for the reason it exists on the Pill: without it
        * a long folder path refuses to shrink and widens the whole menu. */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        {description && (
          <span className="text-xs leading-snug text-muted-foreground">{description}</span>
        )}
      </span>
    </>
  )
}

/**
 * The active row is a neutral selected surface PLUS a trailing accent
 * check — two signals, and deliberately no third. Accent must never become
 * a row-width wash: `visual-style.md` reserves hue for button-level
 * elements, and selection surfaces are quiet neutrals one step past hover.
 * A tinted row in a list of eight reads as an alert, not as an answer.
 */
const menuOptionVariants = cva(
  "flex w-full cursor-pointer items-start gap-2.5 rounded-md border-0 bg-transparent p-2 text-left text-foreground hover:bg-muted data-focused:bg-muted data-highlighted:bg-muted",
  {
    variants: {
      active: {
        true: "bg-active hover:bg-active data-focused:bg-active data-highlighted:bg-active",
        false: "",
      },
    },
    defaultVariants: { active: false },
  }
)

function MenuOption({
  className,
  active,
  icon,
  title,
  description,
  ...props
}: Omit<React.ComponentProps<typeof MenuItem>, "children" | "title"> &
  VariantProps<typeof menuOptionVariants> & {
    icon?: React.ComponentType<{ className?: string }>
    title: React.ReactNode
    description?: React.ReactNode
  }) {
  return (
    <MenuItem className={cn(menuOptionVariants({ active }), className)} {...props}>
      <MenuOptionContent icon={icon} title={title} description={description} />
      {active && <CheckIcon className="mt-0.5 size-4 shrink-0 text-accent" />}
    </MenuItem>
  )
}

export { MenuOption, MenuOptionContent, menuOptionVariants }
