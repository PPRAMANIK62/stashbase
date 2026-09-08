import { useRef, useState } from 'react';

import { cn } from '@/lib/utils';

const KEY_STEP_PX = 16;

interface SplitHandleProps {
  /** Accessible name, e.g. "Resize Agent pane". */
  label: string;
  /** Current width of the pane the handle controls, in px. */
  width: number;
  min: number;
  max: number;
  /** Which side of the handle the controlled pane sits on. Dragging toward
   *  that pane shrinks it. */
  pane: 'left' | 'right';
  onWidthChange(width: number): void;
  /** Double-click resets to this width when given. */
  defaultWidth?: number;
  className?: string;
}

/** A vertical drag handle on the seam between two panes. Pointer drag,
 *  arrow keys, and double-click reset all report a clamped width. */
export function SplitHandle({
  className,
  defaultWidth,
  label,
  max,
  min,
  onWidthChange,
  pane,
  width,
}: SplitHandleProps) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const clamp = (value: number) => Math.max(min, Math.min(max, Math.round(value)));

  return (
    <button
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={width}
      className={cn(
        // touch-none keeps a touch drag from turning into a scroll and
        // cancelling the resize mid-gesture.
        'absolute inset-y-0 z-20 w-2 cursor-col-resize touch-none outline-none',
        'after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-transparent after:transition-colors after:duration-80',
        'hover:after:bg-foreground/25 focus-visible:after:bg-[color:var(--focus-ring,#6B97FF)]',
        dragging && 'after:bg-foreground/25',
        className,
      )}
      onDoubleClick={() => {
        if (defaultWidth !== undefined) onWidthChange(clamp(defaultWidth));
      }}
      onKeyDown={(event) => {
        const direction =
          event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
        if (direction === 0) return;
        event.preventDefault();
        const grows = pane === 'right' ? -direction : direction;
        onWidthChange(clamp(width + grows * KEY_STEP_PX));
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
      onPointerDown={(event) => {
        drag.current = { startWidth: width, startX: event.clientX };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const dx = event.clientX - drag.current.startX;
        onWidthChange(clamp(drag.current.startWidth + (pane === 'right' ? -dx : dx)));
      }}
      onPointerUp={(event) => {
        drag.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        setDragging(false);
      }}
      role="separator"
      type="button"
    />
  );
}
