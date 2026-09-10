import { Button } from '@/components/ui/button';

/** One sentence in place of results: idle guidance, progress, or nothing
 *  found. */
export function StatusLine({ children }: { children: string }) {
  return (
    <p className="px-4 py-2 text-caption text-muted-foreground" role="status">
      {children}
    </p>
  );
}

/** A refused search, with the one recovery the reader has. */
export function SearchFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2">
      <p className="text-caption text-destructive" role="alert">
        {message}
      </p>
      <Button onClick={onRetry} size="compact" variant="tertiary">
        Retry
      </Button>
    </div>
  );
}

/** A line under the results: what was left out, or what could not be opened. */
export function FooterNote({ children, tone }: { children: string; tone: 'error' | 'muted' }) {
  return (
    <p
      className={
        tone === 'error'
          ? 'shrink-0 border-t border-border px-4 py-2 text-caption text-destructive'
          : 'shrink-0 border-t border-border px-4 py-2 text-[10px] text-muted-foreground'
      }
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </p>
  );
}
