'use client';

import { forwardRef, useEffect, useRef, type InputHTMLAttributes } from 'react';

import { mergeRefs } from '@/lib/merge-refs';
import { cn } from '@/lib/utils';
import { clamp } from '@/shared/utils/clamp';

interface InlineInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  caretOffset?: number;
  /** Characters selected on mount, when the caller wants a run of the value
   *  ready to replace: a file's stem ahead of its extension. Wins over
   *  `caretOffset`. */
  selection?: { end: number; start: number };
  commitOnBlur?: boolean;
  focusOnMount?: boolean;
  onCancel(): void;
  onChange(value: string): void;
  onCommit(): void;
}

export function caretOffsetAtPoint(container: HTMLElement, x: number, y: number): number {
  const document = container.ownerDocument;
  const position = document.caretPositionFromPoint?.(x, y);
  const node = position?.offsetNode;
  const offset = position?.offset;
  const fallback = document.caretRangeFromPoint?.(x, y);
  const targetNode = node ?? fallback?.startContainer;
  const targetOffset = offset ?? fallback?.startOffset;
  if (!targetNode || targetOffset === undefined || !container.contains(targetNode)) {
    return container.textContent?.length ?? 0;
  }

  const range = document.createRange();
  range.selectNodeContents(container);
  range.setEnd(targetNode, targetOffset);
  return range.toString().length;
}

const InlineInput = forwardRef<HTMLInputElement, InlineInputProps>(
  (
    {
      caretOffset,
      className,
      commitOnBlur = true,
      focusOnMount = true,
      onBlur,
      onCancel,
      onChange,
      onCommit,
      selection,
      ...props
    },
    forwardedRef,
  ) => {
    const ref = useRef<HTMLInputElement | null>(null);
    const selectionStart = selection?.start;
    const selectionEnd = selection?.end;

    useEffect(() => {
      const input = ref.current;
      if (!input || !focusOnMount) return;
      input.focus();
      const inRange = (offset: number) => clamp(offset, 0, input.value.length);
      if (selectionStart !== undefined && selectionEnd !== undefined) {
        input.setSelectionRange(inRange(selectionStart), inRange(selectionEnd));
        return;
      }
      const offset = inRange(caretOffset ?? input.value.length);
      input.setSelectionRange(offset, offset);
    }, [caretOffset, focusOnMount, selectionEnd, selectionStart]);

    return (
      <input
        {...props}
        className={cn(
          'block w-full rounded-none bg-transparent p-0 text-foreground outline-none',
          className,
        )}
        onBlur={(event) => {
          onBlur?.(event);
          if (commitOnBlur && !event.defaultPrevented) onCommit();
        }}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') {
            event.preventDefault();
            onCommit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
        }}
        ref={mergeRefs(ref, forwardedRef)}
      />
    );
  },
);

InlineInput.displayName = 'InlineInput';

export { InlineInput };
