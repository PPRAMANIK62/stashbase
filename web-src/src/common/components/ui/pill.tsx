import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { ChevronDownIcon } from "@/common/components/icons"
import { cn } from "@/common/lib/utils"

/**
 * The ONE quiet "pick a value" trigger: a text label and a small chevron,
 * no fill and no stroke at rest. The composer's model and mode pills and
 * the search popup's scope pill are the same control, so they are the same
 * component — three of them sit in a row above a text field, and giving any
 * of them a button's weight turns a settings strip into a toolbar.
 *
 * It renders through a menu trigger's `render` prop rather than opening a
 * menu itself, because the pill is the affordance and the menu behind it is
 * the caller's business — the scope pill's menu is a list of folders and the
 * mode pill's is two radio groups and a separator.
 *
 * `min-w-0` is the load-bearing part and it cannot be left to a call site.
 * A pill is a flex item in a tight composer bar, and a flex item's default
 * `min-width: auto` refuses to shrink below its content: a long model name
 * pushed the send button off the row instead of shortening itself. The
 * label's `truncate` is the other half of that pair, which is why the
 * component owns both — a caller that spells one without the other gets
 * either an unclipped overflow or a label with nothing to clip.
 */
const pillVariants = cva(
  "inline-flex min-w-0 cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-1.5 py-1 text-xs whitespace-nowrap text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 enabled:hover:bg-muted enabled:hover:text-foreground disabled:cursor-default",
  {
    variants: {
      /** The value is settled for the rest of this surface's life — a chat
       * never rebinds its scope, and a session never changes model once it
       * has content. The pill dims rather than disappearing, because the
       * value it displays is still the answer to "which one is this". */
      locked: { true: "cursor-default opacity-60", false: "" },
    },
    defaultVariants: { locked: false },
  }
)

function Pill({
  className,
  locked,
  children,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof pillVariants>) {
  return (
    <button
      type="button"
      data-slot="pill"
      className={cn(pillVariants({ locked }), className)}
      {...props}
    >
      {/* No leading glyph: the VALUE is the content — often a folder name
        * carrying the user's own emoji — and a second mark beside it reads
        * as decoration. The menu's rows keep their icons. */}
      <span className="truncate">{children}</span>
      {/* 12: a chevron is a direction, not an object, and at 14 it competes
        * with the label it points at. */}
      <ChevronDownIcon className="-ml-px size-3 shrink-0 opacity-75" />
    </button>
  )
}

export { Pill, pillVariants }
