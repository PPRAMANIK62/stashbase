'use client';

import {
  forwardRef,
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type MutableRefObject,
} from 'react';

import { cn } from '@/lib/utils';

interface InlineInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  caretOffset?: number;
  commitOnBlur?: boolean;
  focusOnMount?: boolean;
  onCancel(): void;
  onChange(value: string): void;
  onCommit(): void;
}

const InlineInput = forwardRef<HTMLInputElement, InlineInputProps>(
  (
    {
      caretOffset,
      className,
      commitOnBlur = true,
      focusOnMount = true,
      onCancel,
      onChange,
      onCommit,
      ...props
    },
    forwardedRef,
  ) => {
    const ref = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      const input = ref.current;
      if (!input || !focusOnMount) return;
      input.focus();
      const offset = Math.min(Math.max(caretOffset ?? input.value.length, 0), input.value.length);
      input.setSelectionRange(offset, offset);
    }, [caretOffset, focusOnMount]);

    return (
      <input
        {...props}
        className={cn(
          'block w-full rounded-none bg-transparent p-0 text-foreground outline-none',
          className,
        )}
        onBlur={commitOnBlur ? onCommit : undefined}
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
        ref={(node) => {
          ref.current = node;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else if (forwardedRef) {
            (forwardedRef as MutableRefObject<HTMLInputElement | null>).current = node;
          }
        }}
      />
    );
  },
);

InlineInput.displayName = 'InlineInput';

export { InlineInput };
export type { InlineInputProps };
