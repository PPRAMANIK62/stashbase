import { LoaderCircle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { filesFailure } from '@/features/workspace/application/failure-messages';

/** The tree before it has a listing to show. */
export function FileTreeLoading() {
  return (
    <div className="flex items-center gap-2 px-4 py-5 text-caption text-muted-foreground">
      <LoaderCircle aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />
      Loading files
    </div>
  );
}

export interface FileTreeUnavailableProps {
  error: unknown;
  onRetry(): void;
}

/** A listing that did not arrive. The sentence comes from the failure's kind,
 *  and recovery stays local to Files: the rest of the window is unaffected. */
export function FileTreeUnavailable({ error, onRetry }: FileTreeUnavailableProps) {
  return (
    <div className="px-4 py-4">
      <p className="text-caption text-destructive" role="alert">
        {filesFailure(error).message}
      </p>
      <Button
        className="mt-2"
        leadingIcon={RefreshCw}
        onClick={onRetry}
        size="compact"
        variant="tertiary"
      >
        Retry
      </Button>
    </div>
  );
}
