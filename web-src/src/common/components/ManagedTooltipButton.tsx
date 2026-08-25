import { useLayoutEffect, useRef } from 'react';
import type {
  TooltipButtonProps,
  FocusTransferRef,
} from '@/common/components/TooltipButton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/common/components/ui/tooltip';
import { Button } from '@/common/components/ui/button';

export default function ManagedTooltipButton({
  label,
  side = 'right',
  children,
  focusTransferRef,
  variant = 'ghost',
  size = 'icon-sm',
  ...buttonProps
}: TooltipButtonProps & {
  focusTransferRef: FocusTransferRef;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const { disabled, ...triggerProps } = buttonProps;

  useLayoutEffect(() => {
    if (!focusTransferRef.current) return;
    focusTransferRef.current = false;
    triggerRef.current?.focus();
  }, [focusTransferRef]);

  return (
    <Tooltip>
      {/* The trigger renders AS the Button primitive — still exactly one
        * <button> element, now carrying the recipe rather than the
        * caller's hand-rolled classes, and matching the eager fallback in
        * `TooltipButton` byte for byte while the chunk loads. */}
      <TooltipTrigger
        {...triggerProps}
        ref={triggerRef}
        disabled={disabled}
        render={<Button variant={variant} size={size} disabled={disabled} />}
        type={buttonProps.type ?? 'button'}
        aria-label={label}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
