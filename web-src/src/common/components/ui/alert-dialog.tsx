import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import type { VariantProps } from "class-variance-authority"

import { cn } from "@/common/lib/utils"
import { buttonVariants } from "@/common/components/ui/button"
import { DIALOG_LAYER, type DialogLayer } from "@/common/components/ui/dialog"

function AlertDialog({ ...props }: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({ ...props }: AlertDialogPrimitive.Trigger.Props) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
}

function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
}

function AlertDialogOverlay({
  className,
  layer = "app",
  ...props
}: AlertDialogPrimitive.Backdrop.Props & { layer?: DialogLayer }) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      className={cn(
        "modal-veil fixed inset-0 isolate bg-veil duration-fast data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        DIALOG_LAYER[layer].backdrop,
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  overlayClassName,
  layer = "app",
  ...props
}: AlertDialogPrimitive.Popup.Props & {
  overlayClassName?: string
  /** See `DialogLayer` in `ui/dialog.tsx`. A confirmation raised from a
   *  menu row is the case this exists for. */
  layer?: DialogLayer
}) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay layer={layer} className={overlayClassName} />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        /* Same contract as DialogContent: no width default, no gap
         * default. See the comment there for why a primitive default is
         * worse than none for both. */
        className={cn(
          "fixed top-1/2 left-1/2 grid max-w-overlay-fit -translate-x-1/2 -translate-y-1/2 gap-0 rounded-xl bg-popover p-4 text-sm text-popover-foreground duration-fast outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          DIALOG_LAYER[layer].popup,
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: AlertDialogPrimitive.Title.Props) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("m-0 text-base leading-none font-medium", className)}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: AlertDialogPrimitive.Description.Props) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  variant = "default",
  ...props
}: AlertDialogPrimitive.Close.Props & {
  variant?: VariantProps<typeof buttonVariants>["variant"]
}) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-action"
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  ...props
}: AlertDialogPrimitive.Close.Props) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
