import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import type { MediaPort } from '@/features/documents/application/ports';
import { mediaTranscriptQuery } from '@/features/documents/application/queries';
import { useRequestSignals } from '@/lib/runtime/use-request-signals';

type TranscriptAction = 'cancel' | 'retry' | null;

export function useMediaTranscript(
  active: boolean,
  api: MediaPort,
  runtime: DocumentRuntime,
  version: string,
) {
  const [action, setAction] = useState<TranscriptAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const signalFor = useRequestSignals<'transcript-action'>();
  const query = useQuery({
    ...mediaTranscriptQuery(api, runtime.scope, version),
    enabled: active,
    refetchInterval: (current) => {
      const state = current.state.data;
      if (state?.status === 'pending') return 1_200;
      if (state?.status === 'blocked') return 3_000;
      return false;
    },
  });

  const run = async (next: Exclude<TranscriptAction, null>) => {
    const signal = signalFor('transcript-action');
    setAction(next);
    setActionError(null);
    try {
      if (next === 'cancel') await api.cancelTranscript(runtime.scope.source, signal);
      else await api.reprocessTranscript(runtime.scope.source, signal);
      if (!signal.aborted) await query.refetch();
    } catch {
      if (!signal.aborted) {
        setActionError(
          next === 'cancel'
            ? 'Transcript preparation could not be cancelled.'
            : 'Transcript preparation could not be restarted.',
        );
      }
    } finally {
      if (!signal.aborted) setAction(null);
    }
  };

  return {
    action,
    actionError,
    cancel: () => run('cancel'),
    query,
    retry: () => run('retry'),
  };
}
