import { ChevronRight } from 'lucide-react';
import { useEffect, useId, useState, type Ref } from 'react';

import { Button } from '@/components/ui/button';
import type { ReviewDescription } from '@/features/bug-report/domain/review-session';
import { focusRing } from '@/lib/focus-ring';
import { cn } from '@/lib/utils';

const MAX_FIELD_LENGTH = 12_000;

const FIELD_CLASS = focusRing(
  'block w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-body text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50',
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
          />
          Add steps to reproduce (optional)
        </span>
      </Button>
      <div className="flex flex-col gap-2" hidden={!reproductionOpen} id={reproductionId}>
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
      </div>
    </section>
  );
}
