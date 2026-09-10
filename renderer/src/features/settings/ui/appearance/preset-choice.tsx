import { useId } from 'react';

import { FOCUS_RING_TINT } from '@/lib/focus-ring';
import { useShape } from '@/lib/shape-context';
import { useSize } from '@/lib/size-context';
import { surfaceClasses } from '@/lib/surface-classes';
import { useSurface } from '@/lib/surface-context';
import { cn } from '@/lib/utils';

export interface PresetOption {
  readonly label: string;
  readonly value: string;
}

export interface PresetChoiceProps {
  readonly choices: readonly PresetOption[];
  /** The read has not answered yet, so there is no preset to move. */
  readonly disabled?: boolean;
  readonly label: string;
  readonly value: string | null;
  onChoose(value: string): void;
}

/**
 * A segmented preset picker: one bordered track with the chosen preset drawn
 * as a raised pill.
 *
 * Native radios rather than a tablist, so arrow-key navigation, the single
 * roving tab stop and the group semantics come from the platform. They are
 * grouped by their shared `name`, which is why the instance generates one.
 *
 * The group is named from the row's own title rather than from a `<legend>`:
 * the Settings row already renders that title beside the control, and one
 * visible label doing both jobs beats a second copy of the string that can
 * drift out of step with it.
 */
export function PresetChoice({
  choices,
  disabled = false,
  label,
  onChoose,
  value,
}: PresetChoiceProps) {
  const name = useId();
  const shape = useShape();
  const size = useSize();
  const pill = surfaceClasses(Math.min(useSurface() + 3, 8));

  return (
    <fieldset
      aria-label={label}
      className={cn(
        'm-0 inline-flex items-center border-0 bg-muted p-0 select-none',
        shape.container,
        size.segmentPad,
        disabled && 'opacity-60',
      )}
      disabled={disabled}
      role="radiogroup"
    >
      {choices.map((choice) => {
        const selected = choice.value === value;
        return (
          <label
            className={cn(
              'relative flex items-center px-3 transition-colors duration-fast',
              disabled ? 'cursor-default' : 'cursor-pointer',
              shape.bg,
              size.segmentItem,
              size.gap,
              size.text,
              selected ? cn(pill, 'text-foreground') : 'text-muted-foreground',
              FOCUS_RING_TINT,
              'has-[:focus-visible]:ring-1',
            )}
            key={choice.value}
          >
            <input
              checked={selected}
              className="sr-only"
              name={name}
              onChange={() => onChoose(choice.value)}
              type="radio"
              value={choice.value}
            />
            {choice.label}
          </label>
        );
      })}
    </fieldset>
  );
}
