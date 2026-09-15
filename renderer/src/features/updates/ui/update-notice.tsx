/** The update offer in the sidebar footer. The view model owns copy and
 * commands; the same card renders real offers and isolated developer previews. */
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { UpdateNoticeViewModel } from '@/features/updates/hooks/use-update-notice';
import { useShape } from '@/lib/shape-context';
import { cn } from '@/lib/utils';

export function UpdateNotice({
  notice,
  preview = false,
}: {
  notice: UpdateNoticeViewModel;
  preview?: boolean;
}) {
  const shape = useShape();
  const { failure, offer } = notice;
  const sentence = failure?.message ?? offer?.message ?? null;
  if (sentence === null) return null;

  return (
    <div
      className={cn(
        'flex shrink-0 flex-col gap-2 border border-border bg-surface-3 p-3',
        shape.panel,
      )}
      role={failure?.tone === 'input' ? 'alert' : 'status'}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {preview && (
            <p className="text-caption font-medium text-muted-foreground">Update preview</p>
          )}
          <p
            className={cn(
              'text-caption',
              failure?.tone === 'input' ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {sentence}
          </p>
        </div>
        <Button
          aria-label="Dismiss update notification"
          onClick={notice.dismiss}
          size="icon-compact"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      {offer?.actionLabel && (
        <Button className="w-full" onClick={notice.act} size="compact" variant="secondary">
          {offer.actionLabel}
        </Button>
      )}
    </div>
  );
}
