/**
 * The strip row updating volunteers, and the one refusal it reports.
 *
 * The sentence is chosen rather than stacked. A refusal answers something the
 * reader just pressed, so it holds the row while it stands, and the phase's
 * own sentence comes back the moment the next command clears it. The controls
 * belong to the offer rather than to the sentence, so a refusal arriving
 * mid-offer still leaves the same ways forward. Order follows the workspace
 * strip: waving off first, the strongest affordance last.
 *
 * How loudly the row is said follows the tone, the way `FailureNotice` and the
 * workspace strip both decide it: a refusal of what the reader asked for is an
 * alert in the destructive colour because there is something here to correct,
 * and an updater StashBase could not reach is a quiet status instead, because
 * shouting about a server nobody can fix only adds noise.
 *
 * Nothing here reads a phase. Every word comes from the view model, so a new
 * update phase changes the table that authors it and never this row.
 */
import { Button } from '@/components/ui/button';
import type { UpdateNoticeViewModel } from '@/features/updates/hooks/use-update-notice';
import { cn } from '@/lib/utils';

export function UpdateNotice({ notice }: { notice: UpdateNoticeViewModel }) {
  const { failure, offer } = notice;
  const sentence = failure?.message ?? offer?.message ?? null;
  if (sentence === null) return null;

  return (
    <div
      className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2"
      role={failure?.tone === 'input' ? 'alert' : 'status'}
    >
      <p
        className={cn(
          'min-w-0 flex-1 text-caption',
          failure?.tone === 'input' ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {sentence}
      </p>
      {offer && (
        <>
          <Button onClick={notice.dismiss} size="compact" variant="tertiary">
            Not now
          </Button>
          {offer.releasePageLabel && (
            <Button onClick={notice.openReleasePage} size="compact" variant="tertiary">
              {offer.releasePageLabel}
            </Button>
          )}
          {offer.actionLabel && (
            <Button onClick={notice.act} size="compact" variant="secondary">
              {offer.actionLabel}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
