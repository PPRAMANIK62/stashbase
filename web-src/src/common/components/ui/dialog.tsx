import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/common/lib/utils"
import { Button } from "@/common/components/ui/button"
import { CloseIcon } from "@/common/components/icons"

/**
 * Which stacking pair a dialog occupies. Shared with `alert-dialog.tsx` so
 * the two primitives cannot drift.
 *
 * `app` is every ordinary dialog: it dims the window and the menu ramp sits
 * above it, because a menu can be opened from inside a modal (the library
 * search's scope pill does exactly that).
 *
 * `menu` is the reverse nesting — a dialog raised from inside an open menu
 * or popover, such as the session-history row's "Delete chat?". At the `app`
 * pair that dialog renders BEHIND the popover that opened it, and its
 * backdrop dims everything except the one surface it needs to block.
 *
 * It is a PROP rather than a `z-` class the caller passes through
 * `className`, because the primitive already spells one: two custom `z-`
 * utilities are not a conflict pair tailwind-merge knows, so both would
 * survive and stylesheet order would pick the winner. Choosing inside the
 * primitive means exactly one `z-` class is ever emitted.
 */
type DialogLayer = "app" | "menu"

const DIALOG_LAYER: Record<DialogLayer, { backdrop: string; popup: string }> = {
  app: { backdrop: "z-backdrop", popup: "z-modal" },
  menu: { backdrop: "z-menu-backdrop", popup: "z-menu-modal" },
}

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  layer = "app",
  ...props
}: DialogPrimitive.Backdrop.Props & { layer?: DialogLayer }) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate bg-veil duration-standard data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        DIALOG_LAYER[layer].backdrop,
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  overlayClassName,
  layer = "app",
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  overlayClassName?: string
  layer?: DialogLayer
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay layer={layer} className={cn("modal-veil", overlayClassName)} />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        /* Deliberately NO width and NO gap default.
         *
         * The shadcn recipe shipped `w-full` plus a responsive 384px cap
         * that no caller in this app wants, and each had to beat it with
         * an important-flagged max-w, because tailwind-merge cannot
         * resolve a bare class against a responsive one. A default of its
         * own would have the same problem in reverse: `max-w-overlay-*` is
         * a custom container step tailwind-merge does not recognise
         * either, so a primitive default and a caller override would both
         * survive and stylesheet order would pick the winner. So width is
         * the caller's to state, off the overlay scale, and the primitive
         * keeps only the viewport clamp every floating surface shares.
         *
         * Gap likewise: a dialog is a container, not a rhythm. Its callers
         * compose their own vertical spacing, and all three were spending
         * an important-flagged gap-0 to get out from under `gap-4`. */
        className={cn(
          "fixed top-1/2 left-1/2 grid max-w-overlay-fit -translate-x-1/2 -translate-y-1/2 gap-0 rounded-xl bg-popover p-4 text-sm text-popover-foreground duration-standard outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          DIALOG_LAYER[layer].popup,
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <CloseIcon
            />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "m-0 text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  DIALOG_LAYER,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
export type { DialogLayer }
