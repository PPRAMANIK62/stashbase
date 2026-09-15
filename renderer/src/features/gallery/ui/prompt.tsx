import { Collapsible } from '@base-ui/react/collapsible';
import { Check, ChevronRight, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { focusRing } from '@/lib/focus-ring';
import { useShape } from '@/lib/shape-context';
import { cn } from '@/lib/utils';
import { useRequestSignals } from '@/shared/runtime/use-request-signals';
import { writeToClipboard } from '@/shared/ui/clipboard';
import { FailureLine } from '@/shared/ui/failure-notice';

/** Keyed by the published prompt: late clipboard completion cannot confirm a
 * different entry or a newer request. Copying never changes Agent settings. */
export function GalleryPrompt({ prompt }: { prompt: string | null }) {
  const shape = useShape();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'pending' | 'copied' | 'failed'>('idle');
  const signalFor = useRequestSignals<'copy'>();
  useEffect(() => {
    if (status !== 'copied') return;
    const timer = setTimeout(() => setStatus('idle'), 1_600);
    return () => clearTimeout(timer);
  }, [status]);
  const copy = async () => {
    const signal = signalFor('copy');
    setStatus('pending');
    try {
      await writeToClipboard(prompt ?? '');
      if (!signal.aborted) setStatus('copied');
    } catch {
      if (!signal.aborted) setStatus('failed');
    }
  };
  return (
    <Collapsible.Root onOpenChange={setOpen} open={open}>
      <Collapsible.Trigger
        render={
          <button
            className={cn(
              focusRing(
                '-mx-1 flex cursor-pointer items-center gap-1 px-1 py-0.5 text-caption font-medium tracking-wide text-muted-foreground uppercase',
              ),
              shape.chip,
            )}
            type="button"
          >
            <span>Prompt</span>
            <ChevronRight
              aria-hidden="true"
              className={cn(
                'size-3.5 transition-transform duration-fast motion-reduce:transition-none',
                open && 'rotate-90',
              )}
            />
          </button>
        }
      />
      <Collapsible.Panel className="pt-2">
        <p className="m-0 mb-2 text-caption text-muted-foreground">
          The prompt used to create this project.
        </p>
        <div className={cn('relative border border-border bg-surface-3', shape.panel)}>
          <p
            className={cn(
              'm-0 p-3 pr-10 text-body leading-relaxed whitespace-pre-wrap',
              prompt ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {prompt ?? 'The prompt for this project isn’t published yet.'}
          </p>
          {prompt && (
            <Tooltip content={status === 'copied' ? 'Copied' : 'Copy'} side="bottom">
              <Button
                aria-label={status === 'copied' ? 'Copied' : 'Copy prompt'}
                className="absolute top-1.5 right-1.5"
                disabled={status === 'pending'}
                onClick={() => {
                  void copy();
                }}
                size="icon-compact"
                variant="ghost"
              >
                {status === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              </Button>
            </Tooltip>
          )}
        </div>
        {status === 'failed' && (
          <FailureLine tone="capability">
            Could not copy the prompt. Try Copy again, or select the text and copy it manually.
          </FailureLine>
        )}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
