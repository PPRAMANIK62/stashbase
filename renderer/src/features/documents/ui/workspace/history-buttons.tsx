/** Back and forward through the window's document history. The pair sits in
 *  the sidebar's titlebar band beside the collapse toggle, and in the
 *  workspace titlebar once the sidebar is away. Its scope is documents
 *  whatever the sidebar is showing: each arrow names the file it would go to
 *  and waits disabled at its end of the history. */
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useStore } from 'zustand';

import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import type { DocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';
import { sourceName } from '@/features/documents/domain/document';
import { nextDocumentVisit, previousDocumentVisit } from '@/features/documents/domain/history';
import { useSizeVariant } from '@/lib/size-context';

function HistoryButton({
  direction,
  onStep,
  size,
  target,
}: {
  direction: 'Back' | 'Forward';
  onStep(): void;
  size: 'icon' | 'icon-compact';
  target: string | null;
}) {
  const label = target === null ? direction : `${direction} to ${target}`;
  const Icon = direction === 'Back' ? ArrowLeft : ArrowRight;
  return (
    <Tooltip content={label} side="bottom">
      <Button
        aria-label={label}
        className="ml-1"
        disabled={target === null}
        onClick={onStep}
        size={size}
        variant="ghost"
      >
        <Icon aria-hidden="true" />
      </Button>
    </Tooltip>
  );
}

export function DocumentHistoryButtons({ runtime }: { runtime: DocumentTabsRuntime }) {
  // The same size rule as the sidebar trigger beside the pair, so the three
  // glyphs read as one row.
  const size = useSizeVariant() === 'compact' ? ('icon-compact' as const) : ('icon' as const);
  const previous = useStore(runtime.history.store, previousDocumentVisit);
  const next = useStore(runtime.history.store, nextDocumentVisit);
  return (
    <>
      <HistoryButton
        direction="Back"
        onStep={() => void runtime.back()}
        size={size}
        target={previous ? sourceName(previous.source) : null}
      />
      <HistoryButton
        direction="Forward"
        onStep={() => void runtime.forward()}
        size={size}
        target={next ? sourceName(next.source) : null}
      />
    </>
  );
}
