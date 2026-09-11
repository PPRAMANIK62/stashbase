import type { LucideIcon } from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';

import { InlineInput } from '@/components/ui/inline-input';
import { useShape } from '@/lib/shape-context';
import { cn } from '@/lib/utils';

/**
 * A tree row whose label is being typed: the draft of a new entry, or an
 * existing entry taking a new name. It keeps the row's geometry so the
 * tree does not shift, and edits the way the Chats tree does: the row
 * takes the selected background and the label itself becomes the field,
 * with the caret as the only editing chrome. A name problem reads back
 * beneath the row.
 */
export function FileTreeNameRow({
  caretOffset,
  icon: Icon,
  initialValue,
  label,
  level,
  onCancel,
  onCommit,
  placeholder,
  problem,
  rails,
  selection,
  style,
}: {
  caretOffset?: number | undefined;
  icon: LucideIcon;
  initialValue: string;
  label: string;
  level: number;
  onCancel(): void;
  onCommit(name: string): void;
  placeholder?: string | undefined;
  problem: string | null;
  rails?: ReactNode;
  selection?: { end: number; start: number } | undefined;
  style: CSSProperties;
}) {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();
  const shape = useShape();

  return (
    <div className="relative z-10" role="none">
      {rails}
      <div
        aria-label={label}
        aria-level={level}
        aria-selected={false}
        className={cn(
          'relative flex h-7 items-center gap-1 bg-hover pr-3 text-[12px] text-foreground',
          shape.button,
        )}
        data-tree-name-row=""
        role="treeitem"
        style={style}
      >
        <Icon aria-hidden="true" className="shrink-0" size={14} strokeWidth={1.5} />
        <InlineInput
          aria-invalid={problem !== null || undefined}
          aria-label={label}
          autoComplete="off"
          className="min-w-0 flex-1 text-inherit [font:inherit] placeholder:text-muted-foreground"
          {...(caretOffset === undefined ? {} : { caretOffset })}
          {...(selection === undefined ? {} : { selection })}
          onBlur={() => {
            // Leaving an empty field abandons the task; a typed name commits.
            if (trimmed === '' && initialValue === '') onCancel();
          }}
          onCancel={onCancel}
          onChange={setValue}
          onCommit={() => onCommit(value)}
          placeholder={placeholder}
          spellCheck={false}
          value={value}
        />
      </div>
      {problem && (
        <p className="py-0.5 pr-3 text-caption text-destructive" role="alert" style={style}>
          {problem}
        </p>
      )}
    </div>
  );
}
