import React from 'react';
import { formatMiB } from '@/common/lib/format';
import { Button } from '@/common/components/ui/button';
import { SectionHeading } from '@/common/components/ui/section';
import { StatusMessage } from '@/common/components/ui/status';

/** The AI Index workload notice. Presentational: the surfaces that show it
 *  (the Files panel and the search popup) read the workload through
 *  `useSemanticIndexingNotice` and pass it in. */
export function SemanticIndexingNoticeView({
  awaiting,
  count,
  estimatedBytes,
  failureMessage,
  onStart,
  onDefer,
}: {
  awaiting: boolean;
  count: number;
  estimatedBytes?: number;
  failureMessage?: string;
  onStart: () => void;
  onDefer: () => void;
}) {
  const size = estimatedBytes ? ` · about ${formatMiB(estimatedBytes)}` : '';
  return (
    <StatusMessage tone="warning" className="mx-3 mb-2 flex items-start justify-between gap-2.5 px-2.5 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* The line that NAMES this card, so a real heading rather than a
          * bold div. The type is pinned back to the card's own step: the
          * level is what changed, not the look. */}
        <SectionHeading level={2} className="text-sm">{awaiting ? 'Large AI Index workload' : 'AI Index paused'}</SectionHeading>
        <div className="leading-snug opacity-90">
          About {count.toLocaleString()} file{count === 1 ? '' : 's'} waiting{size}. Building AI Index may take a while and use provider quota. Exact text search remains available.
        </div>
        {failureMessage && (
          <div className="leading-snug opacity-90" role="alert">
            Search also needs attention: {failureMessage}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="outline" size="xs" onClick={onStart}>
          {awaiting ? 'Build AI Index' : 'Resume AI Index'}
        </Button>
        {awaiting && <Button variant="outline" size="xs" onClick={onDefer}>Not now</Button>}
      </div>
    </StatusMessage>
  );
}
