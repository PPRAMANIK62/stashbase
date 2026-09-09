import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import type { IndexDecisionApi } from '@/features/retrieval/application/ports';

export type IndexDecisionAction =
  | 'build'
  | 'dismiss-warning'
  | 'not-now'
  | 'resume'
  | 'retry-index';

/** Runs one AI Index decision at a time for the folder; the status poll
 *  owned elsewhere reports the outcome, so nothing here is optimistic. */
export function useIndexDecisions(api: IndexDecisionApi, folderPath: string) {
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  const mutation = useMutation({
    mutationFn: async (action: IndexDecisionAction) => {
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      switch (action) {
        case 'build':
        case 'resume':
          await api.decide(folderPath, 'start', current.signal);
          return;
        case 'not-now':
          await api.decide(folderPath, 'defer', current.signal);
          return;
        case 'dismiss-warning':
          await api.dismissWarning(folderPath, current.signal);
          return;
        case 'retry-index':
          await api.resync(folderPath, current.signal);
      }
    },
  });
  return {
    error: mutation.isError ? (mutation.error?.message ?? 'The request failed.') : null,
    pendingAction: mutation.isPending ? mutation.variables : null,
    run: (action: IndexDecisionAction) => mutation.mutate(action),
  };
}
