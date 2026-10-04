import { Button } from '@/components/ui/button';
import type { RevisionOrigin } from '@/features/documents/domain/revision';

/** How a review reads, by which way it runs. A proposal offers new text, so
 *  taking a change accepts it. A turn review offers the text from before an
 *  Agent turn against what the turn wrote, so taking a change undoes it and
 *  leaving it keeps the turn's work. The mechanism is the same either way;
 *  only the words change. */
export interface ReviewWording {
  /** The per-change control that takes the offered text. */
  readonly accept: string;
  readonly acceptAll: string;
  count(pending: number): string;
  readonly group: string;
  /** The whole-review control drawn as the primary one. A proposal leads
   *  with taking it; a turn review leads with keeping the turn's work, so
   *  the prominent button never throws away what is already on disk. */
  readonly primary: 'accept' | 'reject';
  /** The per-change control that leaves the document as it is. */
  readonly reject: string;
  readonly rejectAll: string;
}

const PROPOSAL_WORDING: ReviewWording = {
  accept: 'Accept',
  acceptAll: 'Accept all',
  count: (pending) => (pending === 1 ? '1 suggested change' : `${pending} suggested changes`),
  group: 'Suggested changes',
  primary: 'accept',
  reject: 'Reject',
  rejectAll: 'Reject all',
};

const TURN_WORDING: ReviewWording = {
  accept: 'Undo',
  acceptAll: 'Undo all',
  count: (pending) =>
    pending === 1 ? '1 change from this turn' : `${pending} changes from this turn`,
  group: 'Changes from this turn',
  primary: 'reject',
  reject: 'Keep',
  rejectAll: 'Keep all',
};

export function reviewWording(origin: RevisionOrigin): ReviewWording {
  return origin.kind === 'turn' ? TURN_WORDING : PROPOSAL_WORDING;
}

export interface MarkdownReviewBarProps {
  onAcceptAll(): void;
  onRejectAll(): void;
  pending: number;
  wording: ReviewWording;
}

/**
 * What the reader is told while a revision review is open: how much is left
 * to decide, and the two ways to end it in one step. It states what is
 * pending rather than what produced it — the instruction behind a proposal
 * belongs beside the agent that offered it.
 *
 * The bar is also the only way out of a review that has gone wrong. While one
 * is open the editor refuses every edit that is not an accept or a reject, so
 * a review with no controls left in the prose would otherwise freeze the
 * document with nothing to click.
 */
export function MarkdownReviewBar({
  onAcceptAll,
  onRejectAll,
  pending,
  wording,
}: MarkdownReviewBarProps) {
  return (
    <div aria-label={wording.group} className="markdown-review-bar" role="group">
      <span className="markdown-review-count" role="status">
        {wording.count(pending)}
      </span>
      <Button
        onClick={onRejectAll}
        size="compact"
        variant={wording.primary === 'reject' ? 'primary' : 'tertiary'}
      >
        {wording.rejectAll}
      </Button>
      <Button
        onClick={onAcceptAll}
        size="compact"
        variant={wording.primary === 'accept' ? 'primary' : 'tertiary'}
      >
        {wording.acceptAll}
      </Button>
    </div>
  );
}
