/** Toggle switch: a Base UI switch with a thumb animated by a motion value
 *  rather than a CSS transition, so a press that lands mid-travel retargets
 *  the spring instead of restarting it. Track colour, size and shape come from
 *  the token contexts; the component takes only checked state and a label. */

'use client';

import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { motion, useMotionValue, animate, type Transition } from 'framer-motion';
import {
  forwardRef,
  useRef,
  useState,
  useEffect,
  useCallback,
  useId,
  type HTMLAttributes,
} from 'react';

import { focusRing } from '@/lib/focus-ring';
import { motionStyle } from '@/lib/local/motion-style';
import { useSize, type SizeVariant } from '@/lib/size-context';
import { spring } from '@/lib/springs';
import { instant, useMotionTier } from '@/lib/use-motion-tier';
import { cn } from '@/lib/utils';

interface SwitchProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  /** Keep the label for assistive tech but don't render it — for a switch
   *  sitting in a settings row whose title already names the setting. */
  labelHidden?: boolean;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** Pins the switch to one step of the size ladder (see /docs/sizes).
   *  Omitted, it follows the surrounding SizeProvider. */
  size?: SizeVariant;
}

const THUMB_OFFSET = 2;
const DRAG_DEAD_ZONE = 2;

/** The two elements Base UI renders for the control proper: the `role="switch"`
 *  box and the visually-hidden checkbox it mirrors state into. Anything else
 *  inside the wrapper (the label, the padding) is the widened target. */
const CONTROL_SELECTOR = '[role="switch"], input[type="checkbox"]';

const Switch = forwardRef<HTMLDivElement, SwitchProps>(
  (
    { label, labelHidden = false, checked, onToggle, disabled = false, size, className, ...props },
    ref,
  ) => {
    const labelId = useId();
    const hasMounted = useRef(false);
    const [hovered, setHovered] = useState(false);
    const [pressed, setPressed] = useState(false);
    const sizeClasses = useSize(size);
    // Track and thumb geometry are ladder steps like the type and the padding
    // are; the hover pill-extend and press squash scale with the thumb so the
    // compact switch keeps the same feel.
    const m = sizeClasses.switchGeometry;
    const thumbTravel = m.trackWidth - m.thumbSize - THUMB_OFFSET * 2;

    const dragging = useRef(false);
    const didDrag = useRef(false);
    const pointerStart = useRef<{
      clientX: number;
      originX: number;
    } | null>(null);

    const motionX = useMotionValue(checked ? THUMB_OFFSET + thumbTravel : THUMB_OFFSET);

    // The thumb's slide, honouring a reduced-motion preference: the switch
    // still lands in the right place, it just gets there without travelling.
    const slide: Transition = useMotionTier(spring.moderate);

    useEffect(() => {
      hasMounted.current = true;
    }, []);

    const thumbWidth = pressed
      ? m.thumbSize + m.pressExtend
      : hovered
        ? m.thumbSize + m.pillExtend
        : m.thumbSize;
    const thumbHeight = pressed ? m.thumbSize - m.pressShrink : m.thumbSize;
    const thumbY = pressed ? THUMB_OFFSET + m.pressShrink / 2 : THUMB_OFFSET;
    const extraWidth = thumbWidth - m.thumbSize;
    const thumbX = checked ? THUMB_OFFSET + thumbTravel - extraWidth : THUMB_OFFSET;

    useEffect(() => {
      if (dragging.current) return;
      if (!hasMounted.current) {
        motionX.set(thumbX);
      } else {
        animate(motionX, thumbX, slide);
      }
    }, [thumbX, motionX, slide]);

    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (disabled) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        setPressed(true);
        dragging.current = false;
        didDrag.current = false;
        pointerStart.current = {
          clientX: e.clientX,
          originX: motionX.get(),
        };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      },
      [disabled, motionX],
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (!pointerStart.current) return;
        const delta = e.clientX - pointerStart.current.clientX;

        if (!dragging.current) {
          if (Math.abs(delta) < DRAG_DEAD_ZONE) return;
          dragging.current = true;
        }

        const dragMin = THUMB_OFFSET;
        const pressedThumbWidth = m.thumbSize + m.pressExtend;
        const dragMax = m.trackWidth - THUMB_OFFSET - pressedThumbWidth;
        const rawX = pointerStart.current.originX + delta;
        motionX.set(Math.max(dragMin, Math.min(dragMax, rawX)));
      },
      [motionX, m],
    );

    const handlePointerUp = useCallback(() => {
      if (!pointerStart.current) return;
      setPressed(false);

      if (dragging.current) {
        didDrag.current = true;
        dragging.current = false;

        const currentX = motionX.get();
        const dragMin = THUMB_OFFSET;
        const pressedThumbWidth = m.thumbSize + m.pressExtend;
        const dragMax = m.trackWidth - THUMB_OFFSET - pressedThumbWidth;
        const midpoint = (dragMin + dragMax) / 2;

        const shouldBeOn = currentX > midpoint;

        if (shouldBeOn !== checked) {
          onToggle();
        } else {
          const snapTarget = checked ? THUMB_OFFSET + thumbTravel : THUMB_OFFSET;
          animate(motionX, snapTarget, slide);
        }

        requestAnimationFrame(() => {
          didDrag.current = false;
        });
      }

      pointerStart.current = null;
    }, [checked, onToggle, motionX, slide, m, thumbTravel]);

    const handlePointerCancel = useCallback(() => {
      if (!pointerStart.current) return;
      setPressed(false);

      if (dragging.current) {
        dragging.current = false;
        const snapTarget = checked ? THUMB_OFFSET + thumbTravel : THUMB_OFFSET;
        animate(motionX, snapTarget, slide);
      }

      pointerStart.current = null;
    }, [checked, motionX, slide, thumbTravel]);

    return (
      // Presentational wrapper: the nested SwitchPrimitive.Root is the real
      // control — it owns the role, focus, and keyboard activation — while
      // this box only widens the pointer target across the label and gutter.
      <div
        role="presentation"
        ref={ref}
        className={cn(
          'relative z-10 flex cursor-pointer touch-none items-center select-none',
          sizeClasses.gap,
          labelHidden
            ? 'p-0'
            : [sizeClasses.px, sizeClasses.variant === 'compact' ? 'py-1' : 'py-2'],
          disabled && 'pointer-events-none opacity-50',
          className,
        )}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={(event) => {
          if (disabled || didDrag.current) return;
          // A press on the control itself — or on the hidden checkbox Base UI
          // mirrors it into — has already toggled through `onCheckedChange`.
          // It only reaches this wrapper because it bubbles, and acting on it
          // again would undo the change the user just made. Keyboard
          // activation arrives the same way, as a synthesised click. The
          // wrapper exists only to widen the target across the label and the
          // gutter, so those are the clicks it answers.
          const target = event.target;
          if (target instanceof Element && target.closest(CONTROL_SELECTOR)) return;
          onToggle();
        }}
        {...props}
      >
        {/* Switch */}
        <SwitchPrimitive.Root
          checked={checked}
          aria-labelledby={labelId}
          // Base UI passes (checked, eventDetails); narrow to () => void for our onToggle.
          onCheckedChange={() => {
            if (didDrag.current) return;
            onToggle();
          }}
          disabled={disabled}
          tabIndex={0}
          className={cn(
            'relative shrink-0 cursor-pointer rounded-full outline-none',
            'transition-colors duration-fast',
            focusRing('focus-visible:ring-offset-2 focus-visible:ring-offset-background'),
          )}
          style={{
            width: m.trackWidth,
            height: m.trackHeight,
            backgroundColor: checked
              ? hovered
                ? 'var(--control-on-hover)'
                : 'var(--control-on)'
              : hovered
                ? 'color-mix(in oklab, var(--accent), rgb(var(--overlay)) 10%)'
                : 'var(--accent)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <SwitchPrimitive.Thumb
            render={(thumbProps) => {
              const {
                style: baseStyle,
                onDrag: _onDrag,
                onDragStart: _onDragStart,
                onDragEnd: _onDragEnd,
                onAnimationStart: _onAnimationStart,
                onAnimationEnd: _onAnimationEnd,
                onAnimationIteration: _onAnimationIteration,
                ...rest
              } = thumbProps as React.HTMLAttributes<HTMLSpanElement>;
              return (
                <motion.span
                  {...rest}
                  className="absolute top-0 left-0 block rounded-full bg-white shadow-sm"
                  initial={false}
                  style={{ ...motionStyle(baseStyle), x: motionX }}
                  animate={{
                    y: thumbY,
                    width: thumbWidth,
                    height: thumbHeight,
                  }}
                  transition={hasMounted.current ? slide : instant}
                />
              );
            }}
          />
        </SwitchPrimitive.Root>

        {/* Label */}
        <span
          id={labelId}
          className={cn(
            // text-box trim recenters the letterforms against the track; the
            // track is taller than the label, so layout doesn't change.
            'transition-[color] duration-fast [text-box:trim-both_cap_alphabetic]',
            sizeClasses.text,
            checked ? 'text-foreground' : 'text-muted-foreground',
            labelHidden && 'sr-only',
          )}
        >
          {label}
        </span>
      </div>
    );
  },
);

Switch.displayName = 'Switch';

export { Switch };
