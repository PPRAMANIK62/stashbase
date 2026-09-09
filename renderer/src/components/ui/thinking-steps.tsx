/** The assistant's reasoning trace: a collapsible section whose panel holds a
 *  list of steps. This module owns the container — the open state, the header
 *  that toggles it, and the panel the steps sit in — and re-exports the step
 *  parts so `@/components/ui/thinking-steps` stays the one import path a
 *  consumer needs.
 *
 *  The container is separate from the steps on purpose: a step measures and
 *  animates its own height, so a step that streams in while the panel is open
 *  grows inside a panel that is already measuring itself, and neither fights
 *  the other. Motion values come from `@/lib/springs`. */

'use client';

import { Collapsible } from '@base-ui/react/collapsible';
import {
  createContext,
  forwardRef,
  useContext,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { CollapsePanel, TriggerRow } from '@/components/ui/thinking-steps-collapsible';
import {
  ThinkingStep,
  ThinkingStepDetails,
  ThinkingStepSource,
  ThinkingStepSources,
} from '@/components/ui/thinking-steps-item';
import { SizeProvider, type SizeVariant } from '@/lib/size-context';
import { cn } from '@/lib/utils';

/** Open state of the nearest ThinkingSteps root, for the header trigger/panel. */
const ThinkingStepsOpenContext = createContext(false);

// ─── ThinkingSteps (root) ───────────────────────────────────────────────────

interface ThinkingStepsProps extends HTMLAttributes<HTMLDivElement> {
  /** Step on the size ladder. Wins over the surrounding SizeProvider and
   *  propagates to every row inside. */
  size?: SizeVariant;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

const ThinkingSteps = forwardRef<HTMLDivElement, ThinkingStepsProps>(
  ({ size, defaultOpen = true, open, onOpenChange, children, className, ...props }, ref) => {
    // Always drive Base UI as controlled so the header/panel can read the
    // open state (chevron rotation, framer enter/exit) from context.
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const isOpen = open ?? internalOpen;

    const root = (
      <Collapsible.Root
        ref={ref}
        open={isOpen}
        onOpenChange={(next: boolean) => {
          if (open === undefined) setInternalOpen(next);
          onOpenChange?.(next);
        }}
        className={cn('w-80 max-w-full', className)}
        {...props}
      >
        <ThinkingStepsOpenContext.Provider value={isOpen}>
          {children}
        </ThinkingStepsOpenContext.Provider>
      </Collapsible.Root>
    );

    // A size prop pins every row inside to one ladder step.
    return size ? <SizeProvider size={size}>{root}</SizeProvider> : root;
  },
);
ThinkingSteps.displayName = 'ThinkingSteps';

// ─── ThinkingStepsHeader ────────────────────────────────────────────────────

interface ThinkingStepsHeaderProps extends HTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
}

const ThinkingStepsHeader = forwardRef<HTMLButtonElement, ThinkingStepsHeaderProps>(
  ({ children = 'Thinking', className, ...props }, ref) => {
    const isOpen = useContext(ThinkingStepsOpenContext);
    return (
      <TriggerRow ref={ref} open={isOpen} className={className} {...props}>
        {children}
      </TriggerRow>
    );
  },
);
ThinkingStepsHeader.displayName = 'ThinkingStepsHeader';

// ─── ThinkingStepsContent ───────────────────────────────────────────────────

interface ThinkingStepsContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const ThinkingStepsContent = forwardRef<HTMLDivElement, ThinkingStepsContentProps>(
  ({ children, className, ...props }, ref) => {
    const isOpen = useContext(ThinkingStepsOpenContext);
    return (
      <CollapsePanel open={isOpen}>
        <div ref={ref} className={cn('flex flex-col', className)} {...props}>
          {children}
        </div>
      </CollapsePanel>
    );
  },
);
ThinkingStepsContent.displayName = 'ThinkingStepsContent';

export {
  ThinkingStep,
  ThinkingStepDetails,
  ThinkingSteps,
  ThinkingStepsContent,
  ThinkingStepsHeader,
  ThinkingStepSource,
  ThinkingStepSources,
};
