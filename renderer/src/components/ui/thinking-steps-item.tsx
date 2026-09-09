/** One entry in the reasoning trace, and the parts that hang off it.
 *
 *  `ThinkingStep` is the row: the icon column with its connector line, the
 *  label, and an optional description. It animates its own height from a
 *  measured value so a step that streams in — or grows as its body arrives —
 *  opens space smoothly instead of jumping.
 *
 *  `ThinkingStepDetails` is a nested collapsible body, `ThinkingStepSources`
 *  the badge row beneath a step, and `ThinkingStepSource` one badge in it. The
 *  container that holds these lives in `thinking-steps.tsx`; the collapsible
 *  mechanics they share with it live in `thinking-steps-collapsible.tsx`. */

'use client';

import { Collapsible } from '@base-ui/react/collapsible';
import { motion } from 'framer-motion';
import { forwardRef, useState, type HTMLAttributes, type ReactNode } from 'react';

import { Collapse } from '@/components/internal/collapse';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { CollapsePanel, TriggerRow } from '@/components/ui/thinking-steps-collapsible';
import { fontWeights } from '@/lib/font-weight';
import { useIcon, type IconName } from '@/lib/icon-context';
import { keyedByContent } from '@/lib/keyed-by-content';
import { useShape } from '@/lib/shape-context';
import { useSize } from '@/lib/size-context';
import { exitTween, spring, stepSeconds, tween } from '@/lib/springs';
import { useMeasuredSize } from '@/lib/use-measured-size';
import { useMotionTier } from '@/lib/use-motion-tier';
import { cn } from '@/lib/utils';

// ─── ThinkingStep ───────────────────────────────────────────────────────────

type StepStatus = 'complete' | 'active' | 'pending';

interface ThinkingStepProps {
  icon?: IconName;
  showIcon?: boolean;
  label: string;
  description?: string;
  status?: StepStatus;
  /** Stagger before the step's content fades in, in seconds — a list of steps
   *  arriving together reads as a sequence rather than a flash. */
  delay?: number;
  isLast?: boolean;
  children?: ReactNode;
  className?: string;
}

function ThinkingStep({
  icon = 'dot',
  showIcon = true,
  label,
  description,
  status = 'complete',
  delay = stepSeconds.fast,
  isLast = false,
  children,
  className,
}: ThinkingStepProps) {
  const Icon = useIcon(icon);
  const shape = useShape();
  const sizeClasses = useSize();
  const step = useMeasuredSize<HTMLDivElement>();
  const fadeIn = useMotionTier({ ...tween.slow, delay, ease: 'easeOut' } as const);

  if (status === 'pending') return null;

  const isActive = status === 'active';

  return (
    /* Outer: opens space for the step smoothly. Always `open` — a step that
       has arrived stays; what animates is its arrival, which is why it
       animates in and rides the slow tier. */
    <Collapse
      animateIn
      className={cn('relative z-10', className)}
      fade="none"
      height={step.size}
      open
      tier="slow"
    >
      {/* Inner: fades content in after space starts opening — and is the
            element measured for the height above. */}
      <motion.div
        ref={step.ref}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={fadeIn}
      >
        {/* Content row — this is the proximity hover target */}
        <div className={cn('flex gap-2.5 px-2 py-1.5', shape.item)}>
          {/* Icon column with continuous connector line */}
          <div className="flex w-[14px] shrink-0 flex-col items-center">
            <div className="pt-0.5">
              {showIcon ? (
                <Icon
                  size={sizeClasses.variant === 'compact' ? 12 : 14}
                  strokeWidth={1.5}
                  className="text-muted-foreground"
                />
              ) : (
                <div className="flex h-[14px] w-[14px] items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                </div>
              )}
            </div>
            {/* Line stretches from icon to bottom of this step */}
            {!isLast && <div className="mt-1 w-px flex-1 bg-border/60" />}
          </div>

          {/* Text content */}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span
              className={cn(
                sizeClasses.text,
                'leading-tight text-foreground',
                isActive && 'shimmer-text',
              )}
              style={{ fontVariationSettings: fontWeights.medium }}
            >
              {label}
              {isActive && '…'}
            </span>
            {description && (
              <span className={cn(sizeClasses.text, 'leading-snug text-muted-foreground')}>
                {description}
              </span>
            )}
            {children}
          </div>
        </div>
      </motion.div>
    </Collapse>
  );
}

// ─── ThinkingStepDetails (nested collapsible) ───────────────────────────────

interface ThinkingStepDetailsProps {
  summary: string;
  details?: string[];
  defaultOpen?: boolean;
  children?: ReactNode;
  className?: string;
}

function ThinkingStepDetails({
  summary,
  details,
  defaultOpen = false,
  children,
  className,
}: ThinkingStepDetailsProps) {
  const sizeClasses = useSize();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className={cn('mt-1 -ml-3', className)}>
      <TriggerRow open={open} className="gap-1.5 px-3 py-1">
        {summary}
      </TriggerRow>
      <CollapsePanel open={open}>
        <div className="flex flex-col gap-0.5 pt-0.5">
          {keyedByContent(details ?? [], (detail) => detail).map(({ key, item }) => (
            <span
              key={key}
              className={cn('leading-snug text-muted-foreground', sizeClasses.caption)}
            >
              {item}
            </span>
          ))}
          {children}
        </div>
      </CollapsePanel>
    </Collapsible.Root>
  );
}

// ─── ThinkingStepSources ────────────────────────────────────────────────────

interface ThinkingStepSourcesProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const ThinkingStepSources = forwardRef<HTMLDivElement, ThinkingStepSourcesProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('mt-1 flex flex-wrap gap-1.5', className)} {...props}>
        {children}
      </div>
    );
  },
);
ThinkingStepSources.displayName = 'ThinkingStepSources';

// ─── ThinkingStepSource ─────────────────────────────────────────────────────

interface ThinkingStepSourceProps {
  color?: BadgeColor;
  delay?: number;
  children: ReactNode;
  className?: string;
}

function ThinkingStepSource({
  color = 'gray',
  delay = 0,
  children,
  className,
}: ThinkingStepSourceProps) {
  const arrive = useMotionTier({
    ...spring.moderate,
    delay,
    filter: { ...exitTween.base, delay },
  });
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85, filter: 'blur(4px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={arrive}
    >
      <Badge variant="solid" size="compact" color={color} className={className}>
        {children}
      </Badge>
    </motion.span>
  );
}
ThinkingStepSource.displayName = 'ThinkingStepSource';

export { ThinkingStep, ThinkingStepDetails, ThinkingStepSource, ThinkingStepSources };
