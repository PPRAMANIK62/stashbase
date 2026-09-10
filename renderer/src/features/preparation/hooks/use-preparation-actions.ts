import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { preparationFailure } from '@/features/preparation/application/failure-messages';
import type {
  PreparationControlPort,
  PreparationReprocessOptions,
} from '@/features/preparation/application/ports';
import { refreshFolderStatus } from '@/features/preparation/application/queries';
import type { PreparationAction } from '@/features/preparation/domain/readiness';
import type { SourceReference } from '@/shared/domain/source-reference';
import { useRequestSignals } from '@/shared/runtime/use-request-signals';

/** Explicit preparation controls for one source. Every action refetches the
 *  folder status afterwards; nothing is shown optimistically. The explicit
 *  command and the best-effort prepare run in lanes of their own, so opening
 *  a document never cancels a reprocess the reader asked for. */
export function usePreparationActions(api: PreparationControlPort, source: SourceReference) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PreparationAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signalFor = useRequestSignals<'command' | 'prepare'>();

  const invalidate = useCallback(
    () => refreshFolderStatus(queryClient, source.folderPath),
    [queryClient, source.folderPath],
  );

  const run = useCallback(
    async (action: PreparationAction, options: PreparationReprocessOptions = {}) => {
      const signal = signalFor('command');
      setPending(action);
      setError(null);
      try {
        if (action === 'cancel') await api.cancel(source, signal);
        else await api.reprocess(source, options, signal);
        if (!signal.aborted) await invalidate();
      } catch (caught) {
        if (signal.aborted) return;
        setError(preparationFailure(caught).message);
      } finally {
        if (!signal.aborted) setPending(null);
      }
    },
    [api, invalidate, signalFor, source],
  );

  const prepare = useCallback(() => {
    const signal = signalFor('prepare');
    void api
      .prepare(source, signal)
      .then(() => (signal.aborted ? undefined : invalidate()))
      .catch(() => {
        // Prepare-on-open is best effort: unsupported formats and transient
        // failures leave the next status poll to tell the truth.
      });
  }, [api, invalidate, signalFor, source]);

  return {
    cancel: () => run('cancel'),
    error,
    pending,
    prepare,
    reprocess: (options?: PreparationReprocessOptions) => run('reprocess', options),
  };
}
