import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/common/lib/utils"

function TooltipProvider({
  delay = 600,
  closeDelay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      closeDelay={closeDelay}
      {...props}
    />
  )
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 8,
  children,
  ...props
}: TooltipPrimitive.Positioner.Props & {
  children: React.ReactNode
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        data-slot="tooltip-positioner"
        sideOffset={sideOffset}
        collisionPadding={8}
        className="z-tooltip"
        {...props}
      >
        {/* The same entrance grammar as the menu and the popover — fade up
          * from 96% out of `origin-anchor` — plus one thing neither of
          * them needs: a 4px nudge from the side it is on.
          *
          * The nudge earns its keep here because a tooltip is the only
          * anchored surface with no visual attachment to its trigger. A
          * menu or popover sits 6px off its control and lands with an
          * edge aligned to it, so the anchored scale alone says where it
          * came from; a tooltip floats 8px away, carries no arrow, and can
          * appear on any of four sides, so the direction it travels is the
          * only cue naming the control it belongs to.
          *
          * The exit is one role step quicker than the entrance (fast 120ms
          * in, instant 100ms out) and drops the nudge: a tooltip leaves
          * because the pointer has already moved on. */}
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "max-w-overlay-xs rounded-md border border-border bg-popover px-2 py-1 text-sm leading-tight whitespace-normal text-popover-foreground shadow-elevation outline-none origin-anchor transition-surface data-[starting-style]:scale-96 data-[starting-style]:opacity-0 data-[ending-style]:scale-96 data-[ending-style]:opacity-0 data-[ending-style]:duration-instant data-[side=bottom]:data-[starting-style]:-translate-y-1 data-[side=left]:data-[starting-style]:translate-x-1 data-[side=right]:data-[starting-style]:-translate-x-1 data-[side=top]:data-[starting-style]:translate-y-1",
            className
          )}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
