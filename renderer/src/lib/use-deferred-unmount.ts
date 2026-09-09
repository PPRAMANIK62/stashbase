import { useCallback, useEffect, useRef, type RefObject } from 'react';

import { exitFallbackMs } from '@/lib/springs';

/** The slice of Base UI's `actionsRef` payload this hook drives. */
interface Unmountable {
  unmount: () => void;
}

/** A spring tier from `lib/springs`, read only for its exit duration. */
interface ExitTier {
  exit: { duration: number };
}

interface DeferredUnmount<T extends Unmountable> {
  /** Hand to a Base UI root's `actionsRef` to arm the deferral. */
  actionsRef: RefObject<T | null>;
  /** Call from the exiting element's `onAnimationComplete`. */
  releaseOnExit: () => void;
}

/**
 * Keeps a Base UI portal mounted until its framer exit animation has played.
 *
 * With `actionsRef` set, Base UI stops unmounting a popup on close and waits
 * to be told. `releaseOnExit` is the primary signal — the exit animation
 * finished — and the timer is the fallback for a throttled or background tab,
 * where rAF-driven animation callbacks stall and the portal would otherwise
 * stay mounted forever. The fallback tracks the tier's own exit duration, so
 * it moves whenever the motion tokens do.
 */
export function useDeferredUnmount<T extends Unmountable>(
  open: boolean,
  tier: ExitTier,
): DeferredUnmount<T> {
  const actionsRef = useRef<T | null>(null);

  useEffect(() => {
    if (open) return;
    const id = setTimeout(() => actionsRef.current?.unmount(), exitFallbackMs(tier));
    return () => clearTimeout(id);
  }, [open, tier]);

  const releaseOnExit = useCallback(() => {
    if (!open) actionsRef.current?.unmount();
  }, [open]);

  return { actionsRef, releaseOnExit };
}
