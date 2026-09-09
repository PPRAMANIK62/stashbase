import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { WorkspaceNotice } from './use-workspace-notices';

/** The strip above the workspace where a refusal the reader did not ask about
 *  is reported. A notice they can clear carries its own dismissal, and its
 *  tone decides whether it interrupts: something to correct is an alert, a
 *  capability StashBase could not reach is a status. */
export function WorkspaceNotices({ notices }: { notices: readonly WorkspaceNotice[] }) {
  return notices.map((notice) => (
    <div
      className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2"
      key={notice.message}
      role={notice.tone === 'input' ? 'alert' : 'status'}
    >
      <p
        className={cn(
          'min-w-0 flex-1 text-caption',
          notice.tone === 'input' ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {notice.message}
      </p>
      {notice.onDismiss && (
        <Button onClick={notice.onDismiss} size="compact" variant="tertiary">
          Dismiss
        </Button>
      )}
    </div>
  ));
}
