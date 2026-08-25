import { Popover as PopoverPrimitive } from '@base-ui/react/popover';

import { cn } from '@/common/lib/utils';

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

/**
 * A transient panel anchored to its trigger.
 *
 * `origin-anchor` is the detail: Base UI resolves `--transform-origin` to
 * the corner the popup actually landed on after collision handling, so the
 * panel grows out of the control that was pressed rather than inflating
 * from its own middle. It starts at 96%, never 0 — nothing in the world
 * appears from nothing.
 *
 * The exit is one role step quicker than the entrance (fast 120ms in,
 * instant 100ms out), for the reason spelled out on `MenuPopup`: a
 * dismissal is an instruction already carried out.
 */
function PopoverContent({
  className,
  align = 'center',
  side = 'bottom',
  sideOffset = 6,
  anchor,
  positionerClassName,
  children,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset' | 'anchor'
  > & {
    positionerClassName?: string;
  }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        data-slot="popover-positioner"
        align={align}
        side={side}
        sideOffset={sideOffset}
        anchor={anchor}
        collisionPadding={8}
        className={cn('z-menu', positionerClassName)}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            'flex flex-col rounded-lg border border-border bg-popover p-1 text-base text-popover-foreground shadow-elevation outline-none',
            'origin-anchor transition-surface',
            'data-[starting-style]:scale-96 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-96 data-[ending-style]:opacity-0',
            'data-[ending-style]:duration-instant',
            className,
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn('m-0 text-base leading-snug font-semibold text-foreground', className)}
      {...props}
    />
  );
}

function PopoverDescription({ className, ...props }: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn('m-0 text-sm leading-normal text-muted-foreground', className)}
      {...props}
    />
  );
}

function PopoverClose({ ...props }: PopoverPrimitive.Close.Props) {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />;
}

export {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
};
