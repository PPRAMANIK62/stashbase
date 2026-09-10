/** Command palette surface: the search input, the filtered result list, and
 *  the rows inside it. It owns only presentation and roving keyboard focus —
 *  the caller supplies already-filtered items and handles activation, so the
 *  same primitive serves any palette the product opens. Rendered inside a
 *  Dialog by its callers; this module deliberately does not own the overlay.
 *
 *  A row takes no position and no selected flag from its caller. Rows register
 *  their element with the shared DOM-order registry
 *  (`@/lib/use-dom-order-registry`) and read both back, so a list that filters
 *  an entry out of the middle renumbers nothing, and the list's own item count
 *  comes from the rows that actually mounted rather than from a caller
 *  counting children it may not have rendered directly. */

'use client';

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

import { Kbd } from '@/components/internal/kbd';
import { ProximityHighlight } from '@/components/internal/proximity-highlight';
import { useProximityRow } from '@/components/internal/proximity-row';
import { focusRing } from '@/lib/focus-ring';
import { fontWeights } from '@/lib/font-weight';
import { useIcon } from '@/lib/icon-context';
import { mergeRefs } from '@/lib/merge-refs';
import { useShape } from '@/lib/shape-context';
import { useSize } from '@/lib/size-context';
import {
  useDomOrderCount,
  useDomOrderRegistry,
  type DomOrderRegistry,
} from '@/lib/use-dom-order-registry';
import { useProximityHover } from '@/lib/use-proximity-hover';
import { cn } from '@/lib/utils';

interface CommandListContextValue {
  activeIndex: number | null;
  registerItem(index: number, element: HTMLElement | null): void;
  registry: DomOrderRegistry;
}

const CommandListContext = createContext<CommandListContextValue | null>(null);

interface CommandInputProps extends InputHTMLAttributes<HTMLInputElement> {
  shortcut?: string;
}

const CommandInput = forwardRef<HTMLInputElement, CommandInputProps>(
  ({ className, shortcut, ...props }, ref) => {
    const SearchIcon = useIcon('search');
    const sizeClasses = useSize();
    return (
      <div
        className={cn(
          'flex items-center border-b border-border px-4',
          sizeClasses.prompt,
          sizeClasses.gap,
        )}
      >
        <SearchIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={ref}
          className={cn(
            'h-full min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground',
            sizeClasses.promptText,
            className,
          )}
          style={{ fontVariationSettings: fontWeights.normal }}
          {...props}
        />
        {shortcut && (
          <Kbd aria-hidden="true" className="shrink-0 px-1.5" variant="filled">
            {shortcut}
          </Kbd>
        )}
      </div>
    );
  },
);

CommandInput.displayName = 'CommandInput';

interface CommandListProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  /** The row the keyboard is on. The caller owns arrow-key handling because it
   *  also owns activation; the list owns the highlight and the scrolling. */
  activeIndex: number;
  children: ReactNode;
  onActiveIndexChange(index: number): void;
}

const CommandList = forwardRef<HTMLDivElement, CommandListProps>(
  ({ activeIndex, children, className, onActiveIndexChange, ...props }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const shape = useShape();
    const itemRegistry = useDomOrderRegistry();
    // The rows that actually mounted are the list, whoever rendered them.
    const itemCount = useDomOrderCount(itemRegistry);
    const {
      activeIndex: proximityIndex,
      handlers,
      isMeasured,
      itemRects,
      measureItems,
      registerItem,
      sessionRef,
    } = useProximityHover(containerRef);

    useEffect(() => {
      measureItems();
    }, [children, measureItems]);

    useEffect(() => {
      if (proximityIndex !== null && proximityIndex !== activeIndex) {
        onActiveIndexChange(proximityIndex);
      }
    }, [activeIndex, onActiveIndexChange, proximityIndex]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container || itemCount === 0) return;

      if (activeIndex === 0) {
        container.scrollTo({ top: 0 });
        return;
      }

      if (activeIndex === itemCount - 1) {
        container.scrollTo({ top: container.scrollHeight });
        return;
      }

      container
        .querySelector<HTMLElement>(`[data-proximity-index="${activeIndex}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, itemCount]);

    const activeRect = isMeasured ? itemRects[activeIndex] : null;
    const contextValue = useMemo(
      () => ({ activeIndex, registerItem, registry: itemRegistry }),
      [activeIndex, registerItem, itemRegistry],
    );

    return (
      <CommandListContext.Provider value={contextValue}>
        {/* The listbox role belongs to the list, not to whoever mounts it: the
            rows below announce as `option`, and an option outside a listbox is
            an unannounceable row. Every caller used to re-supply it. */}
        <div
          ref={mergeRefs(containerRef, ref)}
          className={cn(
            'relative max-h-[min(300px,calc(100vh-8rem))] overflow-y-auto p-1.5',
            className,
          )}
          onMouseEnter={handlers.onMouseEnter}
          onMouseLeave={handlers.onMouseLeave}
          onMouseMove={handlers.onMouseMove}
          role="listbox"
          // Not a tab stop: the palette's input keeps focus and points at the
          // active row with aria-activedescendant. -1 keeps the listbox
          // programmatically focusable without putting it in the tab order.
          tabIndex={-1}
          {...props}
        >
          <ProximityHighlight
            className={cn('bg-active', shape.bg)}
            rect={activeRect}
            session={sessionRef.current}
          />
          {children}
        </div>
      </CommandListContext.Provider>
    );
  },
);

CommandList.displayName = 'CommandList';

type CommandItemProps = ButtonHTMLAttributes<HTMLButtonElement>;

const CommandItem = forwardRef<HTMLButtonElement, CommandItemProps>(
  ({ children, className, ...props }, ref) => {
    const context = useContext(CommandListContext);
    const shape = useShape();
    const sizeClasses = useSize();

    if (!context) throw new Error('CommandItem must be used within a CommandList');

    // Position and selected state both come from where the row sits, so a
    // filtered list never hands a row a number that disagrees with the DOM.
    const {
      index,
      isActive,
      ref: rowRef,
    } = useProximityRow<HTMLButtonElement>(ref, context, false);

    return (
      <button
        ref={rowRef}
        aria-selected={isActive}
        className={cn(
          focusRing(
            'relative z-10 flex w-full cursor-pointer items-center gap-2.5 px-3 text-left transition-colors duration-fast outline-none disabled:pointer-events-none disabled:opacity-50',
          ),
          sizeClasses.control,
          sizeClasses.text,
          shape.item,
          className,
        )}
        data-proximity-index={index}
        role="option"
        tabIndex={-1}
        type="button"
        {...props}
      >
        {children}
      </button>
    );
  },
);

CommandItem.displayName = 'CommandItem';

export { CommandInput, CommandItem, CommandList };
