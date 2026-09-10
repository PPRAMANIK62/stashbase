import { CaseSensitive, ChevronDown, ChevronUp, WholeWord, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';

import { Button } from '@/components/ui/button';
import { InputField, InputGroup } from '@/components/ui/input-group';
import type { DocumentNavigationRuntime } from '@/features/documents/application/navigation-runtime';
import { useShape } from '@/lib/shape-context';
import { surfaceClasses } from '@/lib/surface-classes';
import { cn } from '@/lib/utils';

export function DocumentFind({ runtime }: { runtime: DocumentNavigationRuntime }) {
  const find = useStore(runtime.store, (state) => state.find);
  const inputGroupRef = useRef<HTMLDivElement | null>(null);
  const shape = useShape();

  useEffect(() => {
    if (!find.open) return;
    const input = inputGroupRef.current?.querySelector('input');
    input?.focus();
    input?.select();
  }, [find.focusRevision, find.open]);

  if (!find.open) return null;
  const hasQuery = find.query.length > 0;

  return (
    <div
      aria-label="Find in document"
      className={cn(
        'absolute top-3 right-3 z-30 flex items-center gap-0.5 border border-border p-1',
        shape.container,
        surfaceClasses(3, 5),
      )}
      role="search"
    >
      <div className="flex items-center gap-0.5">
        <InputGroup className="w-40 shrink-0" ref={inputGroupRef} size="compact">
          <InputField
            label="Find in document"
            labelHidden
            onChange={runtime.setFindQuery}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (event.shiftKey) runtime.findPrevious();
                else runtime.findNext();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                runtime.closeFind();
              }
            }}
            placeholder="Find"
            value={find.query}
          />
        </InputGroup>
        <span
          aria-live="polite"
          className="w-8 shrink-0 text-center text-caption text-muted-foreground tabular-nums"
          role="status"
        >
          {hasQuery ? (find.total === 0 ? '0/0' : `${find.current}/${find.total}`) : ''}
        </span>
      </div>
      <div aria-label="Find matching options" className="flex items-center" role="group">
        <Button
          aria-label="Match case"
          aria-pressed={find.caseSensitive}
          active={find.caseSensitive}
          onClick={() => runtime.setFindCaseSensitive(!find.caseSensitive)}
          size="icon-compact"
          title="Match case"
          variant="ghost"
        >
          <CaseSensitive aria-hidden="true" />
        </Button>
        <Button
          aria-label="Match whole word"
          aria-pressed={find.wholeWord}
          active={find.wholeWord}
          onClick={() => runtime.setFindWholeWord(!find.wholeWord)}
          size="icon-compact"
          title="Match whole word"
          variant="ghost"
        >
          <WholeWord aria-hidden="true" />
        </Button>
      </div>
      <div aria-label="Find result navigation" className="flex items-center" role="group">
        <Button
          aria-label="Previous match"
          disabled={find.total === 0}
          onClick={() => runtime.findPrevious()}
          size="icon-compact"
          title="Previous match (Shift+Enter)"
          variant="ghost"
        >
          <ChevronUp aria-hidden="true" />
        </Button>
        <Button
          aria-label="Next match"
          disabled={find.total === 0}
          onClick={() => runtime.findNext()}
          size="icon-compact"
          title="Next match (Enter)"
          variant="ghost"
        >
          <ChevronDown aria-hidden="true" />
        </Button>
      </div>
      <Button
        aria-label="Close find"
        onClick={() => runtime.closeFind()}
        size="icon-compact"
        title="Close find (Escape)"
        variant="ghost"
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
