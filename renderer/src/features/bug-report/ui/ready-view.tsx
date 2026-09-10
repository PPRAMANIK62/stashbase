import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { failureMessage } from '@/features/bug-report/application/failure-messages';
import type { BugReportReviewRuntime } from '@/features/bug-report/application/review-runtime';
import type { ReadySession } from '@/features/bug-report/domain/review-session';

import { UNPREPARED_TEXT } from './labels';

export interface ReadyViewProps {
  runtime: BugReportReviewRuntime;
  session: ReadySession;
}

export function ReadyView({ runtime, session }: ReadyViewProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const prepared = session.handoff.kind === 'prepared';
  const busy = session.pending !== null;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-title font-semibold outline-none" ref={headingRef} tabIndex={-1}>
          Report ready
        </h1>
        <p className="text-body text-muted-foreground">
          {prepared
            ? 'Your selected attachments were prepared locally.'
            : 'Your report is approved; its files still need to be prepared locally.'}
        </p>
      </header>
      {session.handoff.kind !== 'prepared' && (
        <section className="flex flex-col gap-2 rounded-md border border-destructive bg-surface-1 p-3">
          <p className="text-body">
            {session.handoff.kind === 'failed'
              ? failureMessage(session.handoff.failure.kind)
              : UNPREPARED_TEXT}
          </p>
          <Button
            className="self-start"
            disabled={busy}
            onClick={() => void runtime.retryPrepare()}
            type="button"
          >
            Try Again
          </Button>
        </section>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-md border border-border bg-surface-1 p-3">
          <p className="text-body text-muted-foreground">
            The report files will be saved to your Downloads folder, and a prefilled GitHub issue
            will open. Attach the files to the issue.
          </p>
          <Button
            className="self-start"
            disabled={!prepared || busy}
            onClick={() => void runtime.openGitHub()}
            type="button"
          >
            Open GitHub
          </Button>
        </section>
        <section className="flex flex-col gap-2 rounded-md border border-border bg-surface-1 p-3">
          <p className="text-body text-muted-foreground">
            Save the report files to your Downloads folder without opening GitHub.
          </p>
          <Button
            className="self-start"
            disabled={!prepared || busy}
            onClick={() => void runtime.download()}
            type="button"
            variant="secondary"
          >
            Download
          </Button>
        </section>
      </div>
      <footer className="flex justify-end gap-2">
        <Button
          disabled={busy}
          onClick={() => void runtime.reopen()}
          type="button"
          variant="secondary"
        >
          Back
        </Button>
        <Button
          disabled={busy}
          onClick={() => void runtime.close()}
          type="button"
          variant="secondary"
        >
          Close
        </Button>
      </footer>
    </>
  );
}
