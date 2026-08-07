import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const cardVariants = cva("rounded-lg border border-border text-foreground", {
  variants: {
    variant: {
      // Flat sits on the page surface; raised lifts panels and previews.
      flat: "bg-background",
      raised: "bg-card shadow-low",
      sunken: "bg-pane",
    },
  },
  defaultVariants: {
    variant: "flat",
  },
})

function Card({
  className,
  variant = "flat",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant, className }))}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex items-center gap-2 border-b border-border px-3 py-2", className)}
      {...props}
    />
  )
}

function CardBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-body" className={cn("p-3", className)} {...props} />
  )
}

export { Card, CardHeader, CardBody, cardVariants }
