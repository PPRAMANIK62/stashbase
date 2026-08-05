import type { EffortLevel } from './types';

export const EFFORT_LEVELS: EffortLevel[] = ['low', 'medium', 'high', 'xhigh', 'max'];

export interface EffortMenuStateInput {
  open: boolean;
  disabled: boolean;
  locked: boolean;
}

export interface EffortMenuState {
  isOpen: boolean;
  triggerDisabled: boolean;
}

/** Keep the popover visible while a fresh Agent session reconnects. */
export function effortMenuState({
  open,
  disabled,
  locked,
}: EffortMenuStateInput): EffortMenuState {
  return {
    isOpen: open && !locked,
    // Reconnect disables the rest of the composer, but an already-open picker
    // must retain its trigger as a close action. A closed picker cannot open
    // until the fresh native session is ready.
    triggerDisabled: locked || (disabled && !open),
  };
}

/** Normalize React Aria's controlled selection into a changed effort level. */
export function changedEffortSelection(
  keys: 'all' | Iterable<unknown>,
  current: EffortLevel | undefined,
  supported: readonly EffortLevel[] = EFFORT_LEVELS,
): EffortLevel | undefined | null {
  if (keys === 'all') return null;
  const next = keys[Symbol.iterator]().next().value;
  if (next === '__default__') return current ? undefined : null;
  return typeof next === 'string'
    && next !== current
    && supported.includes(next as EffortLevel)
    ? next as EffortLevel
    : null;
}
