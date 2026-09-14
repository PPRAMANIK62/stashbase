import { ChevronRight } from 'lucide-react';
import { useEffect, useId, useState, type Ref } from 'react';

import { Button } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import type { ReviewDescription } from '@/features/bug-report/domain/review-session';
import { shapeTokens } from '@/lib/shape-context';
import { cn } from '@/lib/utils';
import { textFieldClass } from '@/shared/ui/text-field';

const MAX_FIELD_LENGTH = 12_000;

// A plain form field on the window's own background, which the reader may
// drag taller when their description runs long.
const FIELD_CLASS = textFieldClass(
  'resize-y bg-background text-body text-foreground',
  shapeTokens.input,
);

export interface DescriptionFieldsProps {
  description: ReviewDescription;
  disabled: boolean;
  onCommit(): void;
  onEdit(description: ReviewDescription): void;
  problemRef: Ref<HTMLTextAreaElement>;
}

export function DescriptionFields({
  description,
  disabled,
  onCommit,
  onEdit,
  problemRef,
}: DescriptionFieldsProps) {
  const problemId = useId();
  const reproductionId = useId();
  const hasReproduction = description.reproduction.trim() !== '';
  const [reproductionOpen, setReproductionOpen] = useState(hasReproduction);
  useEffect(() => {
    if (hasReproduction) setReproductionOpen(true);
  }, [hasReproduction]);

  return (
    <section className="flex flex-col gap-2">
      <label className="text-body font-medium" htmlFor={problemId}>
        What went wrong?
      </label>
      <textarea
        className={FIELD_CLASS}
        disabled={disabled}
        id={problemId}
        maxLength={MAX_FIELD_LENGTH}
        onBlur={onCommit}
        onChange={(event) => onEdit({ ...description, problem: event.target.value })}
        placeholder="Describe what happened. Include what you expected if it isn’t obvious."
        ref={problemRef}
        rows={6}
        value={description.problem}
      />
      <Button
        aria-controls={reproductionId}
        aria-expanded={reproductionOpen}
        className="self-start"
        onClick={() => setReproductionOpen((open) => !open)}
        size="compact"
        type="button"
        variant="ghost"
      >
        <span className="inline-flex items-center gap-1.5">
          <ChevronRight
            aria-hidden="true"
            className={cn(
              'size-3.5 transition-transform duration-fast motion-reduce:transition-none',
              reproductionOpen && 'rotate-90',
            )}
            strokeWidth={1.5}
          />
          Add steps to reproduce (optional)
        </span>
      </Button>
      {/* The field unmounts while the region is closed rather than sitting at
          height zero: the section spaces its children, so a zero-height child
          would still take the gap above it, and a closed field must not be
          reachable by tab. Its text lives in the description, so nothing is
          lost by the trip. */}
      <Disclosure className="flex flex-col gap-2" id={reproductionId} open={reproductionOpen}>
        <label className="text-body font-medium" htmlFor={`${reproductionId}-field`}>
          Steps to reproduce
        </label>
        <textarea
          className={FIELD_CLASS}
          disabled={disabled}
          id={`${reproductionId}-field`}
          maxLength={MAX_FIELD_LENGTH}
          onBlur={onCommit}
          onChange={(event) => onEdit({ ...description, reproduction: event.target.value })}
          placeholder={'1. …\n2. …\n3. …'}
          rows={4}
          value={description.reproduction}
        />
      </Disclosure>
    </section>
  );
}
