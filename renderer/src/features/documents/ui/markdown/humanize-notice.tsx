/**
 * What the reader is told while Hemmingway-1 works, and why a request did
 * not become a review: one line at the foot of the document, with the one
 * action that fits it. A refusal stays until dismissed, because the reader
 * may have looked away while the service answered.
 */
import { Button } from '@/components/ui/button';

import type { HumanizeControls } from './use-humanize';

export function HumanizeNotice({ controls }: { controls: HumanizeControls }) {
  const { status } = controls;
  if (status.kind === 'idle') return null;
  const running = status.kind === 'running';
  return (
    <div
      className="markdown-humanize-notice"
      data-state={status.kind}
      role={running ? 'status' : 'alert'}
    >
      <span>{running ? 'Humanizing with Hemmingway-1…' : status.message}</span>
      <Button
        onClick={running ? controls.cancel : controls.dismiss}
        size="compact"
        variant="tertiary"
      >
        {running ? 'Cancel' : 'Dismiss'}
      </Button>
    </div>
  );
}
