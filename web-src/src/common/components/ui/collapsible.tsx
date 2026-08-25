import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"

import { cn } from "@/common/lib/utils"

/**
 * A disclosure: one trigger, one panel that trigger owns.
 *
 * The part worth a primitive is the wiring, not the toggle. Base UI's
 * trigger carries `aria-expanded` AND `aria-controls` pointing at the
 * panel's own id, and the panel mounts and unmounts with the state. The
 * hand-rolled shape this replaces — a `<button aria-expanded>` next to a
 * conditionally rendered `<div>` — announces that SOMETHING expanded
 * without ever saying what, and leaves the two halves free to disagree.
 *
 * The trigger is a plain part with no surface of its own: pass the
 * `Button` (or any primitive) through `render` and it stays that element,
 * so a disclosure header is a button the size of its own label rather
 * than a full-bleed row that lights up far from the pointer.
 */
function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({ ...props }: CollapsiblePrimitive.Trigger.Props) {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
}

function CollapsiblePanel({ className, ...props }: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-panel"
      className={cn("min-w-0", className)}
      {...props}
    />
  )
}

export { Collapsible, CollapsiblePanel, CollapsibleTrigger }
