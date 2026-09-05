'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import {
  Children,
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

import { useProximityHover } from '@/hooks/use-proximity-hover';
import { fontWeights } from '@/lib/font-weight';
import { useShape } from '@/lib/shape-context';
import { spring } from '@/lib/springs';
import { cn } from '@/lib/utils';

interface CommandListContextValue {
  registerItem(index: number, element: HTMLElement | null): void;
}

const CommandListContext = createContext<CommandListContextValue | null>(null);

interface CommandInputProps extends InputHTMLAttributes<HTMLInputElement> {
  shortcut?: string;
}

const CommandInput = forwardRef<HTMLInputElement, CommandInputProps>(
  ({ className, shortcut, ...props }, ref) => {
    const shape = useShape();

    return (
      <div className="flex h-12 items-center gap-3 border-b border-border px-4">
        <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={ref}
          className={cn(
            'h-full min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground',
            className,
          )}
          style={{ fontVariationSettings: fontWeights.normal }}
          {...props}
        />
        {shortcut && (
          <kbd
            aria-hidden="true"
            className={cn(
              'shrink-0 bg-foreground/10 px-1.5 py-1 text-[11px] leading-none text-muted-foreground',
              shape.bg,
            )}
          >
            {shortcut}
          </kbd>
        )}
      </div>
    );
  },
);

CommandInput.displayName = 'CommandInput';

interface CommandListProps extends HTMLAttributes<HTMLDivElement> {
  activeIndex: number;
  children: ReactNode;
  itemCount?: number;
  onActiveIndexChange(index: number): void;
}

const CommandList = forwardRef<HTMLDivElement, CommandListProps>(
  (
    { activeIndex, children, className, itemCount: itemCountProp, onActiveIndexChange, ...props },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const itemCount = itemCountProp ?? Children.count(children);
    const shape = useShape();
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
    const contextValue = useMemo(() => ({ registerItem }), [registerItem]);

    return (
      <CommandListContext.Provider value={contextValue}>
        <div
          ref={(node) => {
            (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }}
          className={cn(
            'relative max-h-[min(300px,calc(100vh-8rem))] overflow-y-auto p-1.5',
            className,
          )}
          onMouseEnter={handlers.onMouseEnter}
          onMouseLeave={handlers.onMouseLeave}
          onMouseMove={handlers.onMouseMove}
          {...props}
        >
          <AnimatePresence>
            {activeRect && (
              <motion.div
                key={sessionRef.current}
                aria-hidden="true"
                className={cn('pointer-events-none absolute bg-active', shape.bg)}
                initial={{
                  opacity: 0,
                  top: activeRect.top,
                  left: activeRect.left,
                  width: activeRect.width,
                  height: activeRect.height,
                }}
                animate={{
                  opacity: 1,
                  top: activeRect.top,
                  left: activeRect.left,
                  width: activeRect.width,
                  height: activeRect.height,
                }}
                exit={{ opacity: 0, transition: spring.fast.exit }}
                transition={{ ...spring.fast, opacity: { duration: 0.08 } }}
              />
            )}
          </AnimatePresence>
          {children}
        </div>
      </CommandListContext.Provider>
    );
  },
);

CommandList.displayName = 'CommandList';

interface CommandItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
  index: number;
}

const CommandItem = forwardRef<HTMLButtonElement, CommandItemProps>(
  ({ active, children, className, index, ...props }, ref) => {
    const internalRef = useRef<HTMLButtonElement>(null);
    const context = useContext(CommandListContext);
    const shape = useShape();

    if (!context) throw new Error('CommandItem must be used within a CommandList');

    useEffect(() => {
      context.registerItem(index, internalRef.current);
      return () => context.registerItem(index, null);
    }, [context, index]);

    return (
      <button
        ref={(node) => {
          (internalRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
        }}
        aria-selected={active}
        className={cn(
          'relative z-10 flex h-9 w-full cursor-pointer items-center gap-2.5 px-3 text-left text-[13px] transition-colors duration-80 outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)] disabled:pointer-events-none disabled:opacity-50',
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
