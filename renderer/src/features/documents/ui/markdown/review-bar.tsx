import { Button } from '@/components/ui/button';

export interface MarkdownReviewBarProps {
  onAcceptAll(): void;
  onRejectAll(): void;
  pending: number;
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
export function MarkdownReviewBar({ onAcceptAll, onRejectAll, pending }: MarkdownReviewBarProps) {
  return (
    <div aria-label="Suggested changes" className="markdown-review-bar" role="group">
      <span className="markdown-review-count" role="status">
        {pending === 1 ? '1 suggested change' : `${pending} suggested changes`}
      </span>
      <Button onClick={onRejectAll} size="compact" variant="tertiary">
        Reject all
      </Button>
      <Button onClick={onAcceptAll} size="compact" variant="primary">
        Accept all
      </Button>
    </div>
  );
}
