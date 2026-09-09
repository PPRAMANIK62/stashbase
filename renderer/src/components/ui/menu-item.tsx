'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  createContext,
  useContext,
  useRef,
  useEffect,
  forwardRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';

import { fontWeights } from '@/lib/font-weight';
import type { IconComponent } from '@/lib/icon-context';
import { shapeMap } from '@/lib/shape-context';
import { useSize } from '@/lib/size-context';
import { cn } from '@/lib/utils';

import { Button } from './button';

// MenuItem is only used inside Dropdown, which opts out of the global pill
// shape — see dropdown.tsx for the rationale.
const shape = shapeMap.rounded;

// ---------------------------------------------------------------------------
// Dropdown context — the single shared context for every Dropdown build.
//
// It lives here rather than in the dropdown module so that (a) MenuItem stays
// primitive-free and self-contained, and (b) dropdowns built on different
// primitives (Radix, Base UI) can render side by side — each provides this
// same context object, so MenuItem resolves whichever provider actually
// wraps it. The dropdown module re-exports useDropdown from here, keeping
// its public API unchanged.
// ---------------------------------------------------------------------------

/** What MenuItem hands to the popup's primitive wrapper. `element` is the
 *  styled row div (visuals + proximity registration, no children); `children`
 *  is the row content (icon, label, trailing action, check). The dropdown wraps them in its
 *  own Item / RadioItem primitive, so MenuItem itself stays primitive-free. */
export interface MenuItemRenderOptions {
  /** Radio-style option (boolean `checked` on MenuItem) vs plain action item. */
  radio: boolean;
  /** The item's index — doubles as the radio value. */
  value: number;
  disabled?: boolean;
  label: string;
  closeOnClick: boolean;
  element: ReactElement;
  children: ReactNode;
}

export interface DropdownContextValue {
  registerItem: (index: number, element: HTMLElement | null) => void;
  activeIndex: number | null;
  checkedIndex?: number;
  /** True when items render inside a Menu popup (DropdownContent), where the
   *  primitive's Item / RadioItem own roles, roving highlight, typeahead,
   *  and activation. MenuItem switches its rendering accordingly. */
  inMenu?: boolean;
  /** Popup-only: wraps a MenuItem's styled div in the dropdown's menu-item
   *  primitive. Absent in the inline Dropdown panel, where MenuItem renders
   *  its own ARIA menuitem div. */
  renderMenuItem?: (opts: MenuItemRenderOptions) => ReactElement;
}

export const DropdownContext = createContext<DropdownContextValue | null>(null);

export function useDropdown() {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error('useDropdown must be used within a Dropdown');
  return ctx;
}

/** Null-safe context read for callers that render outside a provider. */
export function useDropdownMaybe() {
  return useContext(DropdownContext);
}

export interface MenuItemTrailingAction {
  icon: IconComponent;
  label: string;
  onSelect(): void;
}

interface MenuItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional leading icon. When omitted, the row renders text-only with no
   *  reserved icon column. */
  icon?: IconComponent;
  label: string;
  /** Optional explanatory copy for choices whose consequence cannot be
   *  understood from the short label alone. */
  description?: string;
  /** Places short explanatory copy beside the label in compact choice menus. */
  descriptionLayout?: 'stacked' | 'inline';
  /** Controls how a label behaves when it is wider than the menu row. */
  labelLayout?: 'truncate' | 'wrap';
  /** Optional optical adjustment for the label-and-description group. */
  contentClassName?: string;
  index: number;
  /** When a boolean, the item is a radio-style option (role="menuitemradio"
   *  with aria-checked). When undefined, it is a plain action item
   *  (role="menuitem", no checked state announced). */
  checked?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  /** Popup-only (inside DropdownContent): whether activating the item closes
   *  the menu. Ignored in the inline Dropdown panel. @default true */
  closeOnClick?: boolean;
  /** A compact secondary action at the row's trailing edge. The focused row
   *  also exposes the action through the Delete key. */
  trailingAction?: MenuItemTrailingAction;
}

const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(
  (
    {
      icon: Icon,
      label,
      description,
      descriptionLayout = 'stacked',
      labelLayout = 'truncate',
      contentClassName,
      index,
      checked,
      onSelect,
      disabled,
      closeOnClick,
      trailingAction,
      className,
      onClick,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    const internalRef = useRef<HTMLDivElement>(null);
    const hasMounted = useRef(false);
    const { registerItem, activeIndex, checkedIndex, renderMenuItem } = useDropdown();

    useEffect(() => {
      registerItem(index, internalRef.current);
      return () => registerItem(index, null);
    }, [index, registerItem]);

    useEffect(() => {
      hasMounted.current = true;
    }, []);

    const isActive = activeIndex === index;
    const inlineDescription = Boolean(description && descriptionLayout === 'inline');
    const wrapsLabel = labelLayout === 'wrap';
    const stackedDescription = Boolean(description && !inlineDescription);
    const skipAnimation = !hasMounted.current;
    const sizeClasses = useSize();
    const TrailingActionIcon = trailingAction?.icon;

    const mergeRef = (node: HTMLDivElement | null) => {
      (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    };

    const handleActivate = disabled
      ? undefined
      : (e: React.MouseEvent<HTMLDivElement>) => {
          onClick?.(e);
          onSelect?.();
        };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || disabled) return;
      if (trailingAction && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        event.stopPropagation();
        trailingAction.onSelect();
        return;
      }
      if (!renderMenuItem && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault();
        onSelect?.();
      }
    };

    const accessibleLabel = description ? `${label}. ${description}` : label;
    const itemClassName = cn(
      // Fixed height (was py-2 around a 19.5px line box ≈ 35.5px) so the
      // text-box trim on the label doesn't shrink the row. shrink-0 because
      // menu popups are max-height flex columns — without it a long list
      // compresses rows to fit instead of scrolling.
      `relative z-10 flex ${sizeClasses.control} shrink-0 items-center ${sizeClasses.gap} ${shape.item} ${sizeClasses.itemPx} cursor-pointer outline-none`,
      (wrapsLabel || stackedDescription) && 'h-auto min-h-9 py-2',
      stackedDescription && 'min-h-14',
      disabled && 'pointer-events-none opacity-50',
      className,
    );

    const content = (
      <>
        {Icon && (
          <span className="inline-grid">
            <span className="invisible col-start-1 row-start-1">
              <Icon size={sizeClasses.icon} strokeWidth={2} />
            </span>
            <Icon
              size={sizeClasses.icon}
              strokeWidth={isActive || checked ? 2 : 1.5}
              className={cn(
                'col-start-1 row-start-1 transition-[color,stroke-width] duration-80',
                isActive || checked ? 'text-foreground' : 'text-muted-foreground',
              )}
            />
          </span>
        )}
        {/* Both stacked spans carry the text-box trim so the invisible bold
            sizer and the visible label keep identical boxes. The trimmed box
            ends at the cap line and the baseline, so a truncating label pads
            its clip box back out to cover ascenders and descenders and pulls
            the layout box in again with a matching negative margin. The sizer
            truncates on the same rule as the label: left free to wrap, a long
            label makes it two lines tall and pushes the row's icons off the
            visible text. */}
        <span
          className={cn(
            'flex min-w-0 flex-1',
            sizeClasses.text,
            inlineDescription ? 'items-center gap-2' : 'flex-col items-stretch',
            contentClassName,
          )}
          data-menu-item-content
        >
          <span className="grid min-w-0 flex-1">
            <span
              className={cn(
                'invisible col-start-1 row-start-1 [text-box:trim-both_cap_alphabetic]',
                wrapsLabel ? 'break-words whitespace-normal' : 'truncate',
              )}
              style={{ fontVariationSettings: fontWeights.semibold }}
              aria-hidden="true"
            >
              {label}
            </span>
            <span
              data-menu-item-label
              className={cn(
                'col-start-1 row-start-1 transition-[color,font-variation-settings] duration-80 [text-box:trim-both_cap_alphabetic]',
                wrapsLabel ? 'break-words whitespace-normal' : 'truncate py-[0.3em] -my-[0.3em]',
                isActive || checked ? 'text-foreground' : 'text-muted-foreground',
              )}
              style={{
                fontVariationSettings: checked ? fontWeights.semibold : fontWeights.normal,
              }}
            >
              {label}
            </span>
          </span>
          {description && (
            <span
              className={cn(
                'text-[12px] font-normal text-muted-foreground',
                inlineDescription
                  ? 'min-w-0 truncate'
                  : 'mt-1 block leading-[17px] whitespace-normal',
              )}
            >
              {description}
            </span>
          )}
        </span>
        {trailingAction && TrailingActionIcon && (
          <Button
            aria-label={trailingAction.label}
            className="-my-1 -mr-1 shrink-0"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              trailingAction.onSelect();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            size="icon-compact"
            title={trailingAction.label}
            variant="ghost"
          >
            <TrailingActionIcon aria-hidden="true" />
          </Button>
        )}
        <AnimatePresence>
          {checked && (
            <motion.svg
              key="check"
              width={sizeClasses.icon}
              height={sizeClasses.icon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-foreground"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 1 }}
            >
              <motion.path
                d="M4 12L9 17L20 6"
                initial={{ pathLength: skipAnimation ? 1 : 0 }}
                animate={{
                  pathLength: 1,
                  transition: { duration: 0.08, ease: 'easeOut' },
                }}
                exit={{
                  pathLength: 0,
                  transition: { duration: 0.04, ease: 'easeIn' },
                }}
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </>
    );

    if (renderMenuItem) {
      // Inside DropdownContent, the menu-item primitive (supplied by the
      // surrounding DropdownContent through context) owns the role,
      // aria-checked, tabIndex, roving highlight, typeahead, and Enter/Space/
      // click activation (activation synthesizes a click, so handleActivate
      // also fires for keyboard). The styled div carries the Fluid
      // Functionalism visuals and the proximity-hover registration; MenuItem
      // itself imports no primitive.
      return renderMenuItem({
        radio: typeof checked === 'boolean',
        value: index,
        disabled,
        label: accessibleLabel,
        closeOnClick: closeOnClick ?? true,
        element: (
          <div
            ref={mergeRef}
            data-proximity-index={index}
            aria-label={accessibleLabel}
            aria-keyshortcuts={trailingAction ? 'Delete' : undefined}
            onClick={handleActivate}
            onKeyDown={handleKeyDown}
            className={itemClassName}
            {...props}
          />
        ),
        children: content,
      });
    }

    return (
      <div
        ref={mergeRef}
        data-proximity-index={index}
        // Disabled items are never the roving tab stop.
        tabIndex={!disabled && index === (checkedIndex ?? 0) ? 0 : -1}
        role={typeof checked === 'boolean' ? 'menuitemradio' : 'menuitem'}
        aria-checked={typeof checked === 'boolean' ? checked : undefined}
        aria-disabled={disabled || undefined}
        aria-label={label}
        aria-keyshortcuts={trailingAction ? 'Delete' : undefined}
        onClick={handleActivate}
        onKeyDown={handleKeyDown}
        className={itemClassName}
        {...props}
      >
        {content}
      </div>
    );
  },
);

MenuItem.displayName = 'MenuItem';

export { MenuItem };
export default MenuItem;
