/**
 * Select — the root, and where the current value becomes a label.
 *
 * Built on Base UI's Select primitive, which owns positioning (collision
 * flipping, anchor tracking), dismissal (outside press, focus-out, Escape
 * nesting inside dialogs), list keyboard navigation + typeahead, combobox
 * ARIA, and the hidden form input. This layer adds the open state, the
 * acknowledgment delay before a pick closes the popup, and the option list the
 * trigger needs to name the current value before the popup has ever mounted.
 *
 * That option list is the required `items` prop. The root never inspects
 * `children` to work out what the options are, so a caller is free to nest,
 * group, or decorate its rows however it likes.
 */
'use client';

import { Select as SelectPrimitive } from '@base-ui/react/select';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  createContext,
  useContext,
  type ReactNode,
} from 'react';

import { SizeProvider, type SizeVariant } from '@/lib/size-context';
import { delayMs, spring } from '@/lib/springs';
import { useDeferredUnmount } from '@/lib/use-deferred-unmount';

/** One option as the trigger needs to know it: the value it selects, and the
 *  label to show while it is the current value. */
export interface SelectOption {
  value: string;
  label: ReactNode;
}

interface SelectContextValue {
  value: string;
  open: boolean;
  /** Call from the popup's exit `onAnimationComplete`. */
  releaseOnExit: () => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);

export function useSelectContext(): SelectContextValue {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error('Select compound components must be inside <Select>');
  return ctx;
}

interface SelectProps {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
  required?: boolean;
  /**
   * Every option the popup can offer, as `{ value, label }`, in the order the
   * rows are rendered.
   *
   * Required, because the trigger has to name the current value before the
   * popup has ever mounted — rows render only while the popup is open. Derive
   * it from whatever array the `SelectItem` children are mapped from so the
   * two cannot drift, and give an option whose row is an element that same
   * node as its `label`: this list is what the trigger shows.
   */
  items: readonly SelectOption[];
  /** Pins trigger and popup to one step of the size ladder (default 36px,
   *  compact 28px — see /docs/sizes). Omitted, both follow the surrounding
   *  SizeProvider. */
  size?: SizeVariant;
}

function Select({
  children,
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  items,
  name,
  required,
  size,
}: SelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const [open, setOpen] = useState(false);
  // The popup stays mounted through its exit spring; see useDeferredUnmount.
  const { actionsRef, releaseOnExit } = useDeferredUnmount(open, spring.fast);
  const currentValue = value !== undefined ? value : internalValue;

  const handleValueChange = useCallback(
    (next: string | null) => {
      const v = next ?? '';
      if (value === undefined) setInternalValue(v);
      onValueChange?.(v);
    },
    [value, onValueChange],
  );

  const ackTimeoutRef = useRef<number | null>(null);
  const cancelAckClose = useCallback(() => {
    if (ackTimeoutRef.current !== null) {
      clearTimeout(ackTimeoutRef.current);
      ackTimeoutRef.current = null;
    }
  }, []);
  useEffect(() => cancelAckClose, [cancelAckClose]);

  // Picking an item acknowledges before closing: the close is deferred by the
  // shared acknowledgment dwell so the checkmark draw and the background's spring
  // to the picked row are seen. Every other close reason (Escape, outside
  // press, trigger toggle, focus-out) closes immediately and cancels any
  // pending acknowledgment; re-picking within the window restarts it.
  const handleOpenChange = useCallback(
    (nextOpen: boolean, eventDetails: { reason: string }) => {
      if (!nextOpen && eventDetails.reason === 'item-press') {
        cancelAckClose();
        ackTimeoutRef.current = window.setTimeout(() => {
          ackTimeoutRef.current = null;
          setOpen(false);
        }, delayMs.acknowledge);
        return;
      }
      cancelAckClose();
      setOpen(nextOpen);
    },
    [cancelAckClose],
  );

  const ctx = useMemo(
    () => ({ value: currentValue, open, releaseOnExit }),
    [currentValue, open, releaseOnExit],
  );

  // A size prop pins the whole compound (trigger + portalled popup — React
  // context crosses portals) to one step of the ladder.
  const root = (
    <SelectContext.Provider value={ctx}>
      <SelectPrimitive.Root
        // Always controlled; "" (no selection) maps to Base UI's null.
        value={currentValue === '' ? null : currentValue}
        onValueChange={handleValueChange}
        open={open}
        onOpenChange={handleOpenChange}
        actionsRef={actionsRef}
        items={items}
        disabled={disabled}
        name={name}
        required={required}
        // Non-modal: the page keeps scrolling and the Positioner tracks the
        // anchor, so the popup follows its trigger instead of detaching.
        modal={false}
      >
        {children}
      </SelectPrimitive.Root>
    </SelectContext.Provider>
  );

  return size ? <SizeProvider size={size}>{root}</SizeProvider> : root;
}

Select.displayName = 'Select';

export { Select };
