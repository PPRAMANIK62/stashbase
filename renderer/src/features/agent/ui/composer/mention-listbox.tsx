import { Folder } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { FileTypeIcon } from '@/components/ui/file-type-icon';
import type { MentionSuggestion } from '@/features/agent/domain/context';
import { cn } from '@/lib/utils';

export function mentionOptionId(listboxId: string, index: number): string {
  return `${listboxId}-option-${index}`;
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** The `@` suggestion list. Focus stays in the textarea; the composer points
 *  `aria-activedescendant` at the row the caret is on. */
export function MentionListbox({
  activeIndex,
  id,
  onHover,
  onPick,
  suggestions,
}: {
  activeIndex: number;
  id: string;
  onHover: (index: number) => void;
  onPick: (suggestion: MentionSuggestion) => void;
  suggestions: MentionSuggestion[];
}) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    active?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);
  return (
    <div
      aria-label="Mention a file or folder"
      className="absolute inset-x-0 bottom-full z-20 mb-2 max-h-64 overflow-y-auto rounded-xl border border-border bg-surface-3 p-1 shadow-surface-3"
      id={id}
      ref={listRef}
      role="listbox"
    >
      {suggestions.map((suggestion, index) => {
        const selected = index === activeIndex;
        const name = basename(suggestion.path);
        return (
          <div
            aria-selected={selected}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-body text-foreground',
              selected ? 'bg-hover' : 'hover:bg-hover',
            )}
            id={mentionOptionId(id, index)}
            key={`${suggestion.kind}:${suggestion.path}`}
            onMouseDown={(event) => {
              event.preventDefault();
              onPick(suggestion);
            }}
            onMouseEnter={() => onHover(index)}
            role="option"
            tabIndex={-1}
          >
            {suggestion.kind === 'folder' ? (
              <Folder aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <FileTypeIcon
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground"
                path={suggestion.path}
              />
            )}
            <span className="min-w-0 flex-1 truncate">{name}</span>
            {suggestion.path !== name && (
              <span className="max-w-[50%] min-w-0 truncate text-caption text-muted-foreground">
                {suggestion.path}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
