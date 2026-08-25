import {
  Suspense,
  useLayoutEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import type { VariantProps } from 'class-variance-authority';
import { lazyWithRetry } from '@/common/components/ErrorBoundary';
import { Button, type buttonVariants } from '@/common/components/ui/button';

/** Both halves of this component render the `Button` primitive, so the
 *  eager fallback and the tooltip-wrapped trigger cannot drift apart in
 *  look, press feedback, or focus treatment — the swap between them is
 *  meant to be invisible, and it stops being invisible the moment one of
 *  them is a hand-rolled `<button>` carrying the caller's own classes.
 *  Callers name a variant/size off the recipe like anywhere else; the
 *  defaults are the quiet icon control every current call site wanted. */
export interface TooltipButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  label: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
}

const ManagedTooltipButton = lazyWithRetry(() => import('@/common/components/ManagedTooltipButton'));

interface FocusTransferRef {
  current: boolean;
}

/**
 * The accessible button is available immediately. Only its supplementary
 * visual tooltip is deferred, keeping Base UI positioning out of startup JS.
 */
export function TooltipButton(props: TooltipButtonProps) {
  const focusTransferRef = useRef(false);
  return (
    <Suspense
      fallback={(
        <TooltipButtonFallback {...props} focusTransferRef={focusTransferRef} />
      )}
    >
      <ManagedTooltipButton {...props} focusTransferRef={focusTransferRef} />
    </Suspense>
  );
}

function TooltipButtonFallback({
  label,
  children,
  focusTransferRef,
  variant = 'ghost',
  size = 'icon-sm',
  ...buttonProps
}: TooltipButtonProps & {
  focusTransferRef: FocusTransferRef;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useLayoutEffect(() => () => {
    if (document.activeElement === buttonRef.current) focusTransferRef.current = true;
  }, [focusTransferRef]);

  return (
    <Button
      {...buttonProps}
      variant={variant}
      size={size}
      ref={buttonRef}
      type={buttonProps.type ?? 'button'}
      aria-label={label}
      onFocusCapture={(event) => {
        focusTransferRef.current = true;
        buttonProps.onFocusCapture?.(event);
      }}
      onBlurCapture={(event) => {
        focusTransferRef.current = false;
        buttonProps.onBlurCapture?.(event);
      }}
    >
      {children}
    </Button>
  );
}

export type { FocusTransferRef };
