import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import type { MediaApi } from '@/features/documents/application/ports';
import { mediaTranscriptQuery } from '@/features/documents/application/queries';

type TranscriptAction = 'cancel' | 'retry' | null;

export function useMediaTranscript(
  active: boolean,
  api: MediaApi,
  runtime: DocumentRuntime,
  version: string,
) {
  const [action, setAction] = useState<TranscriptAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
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

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const run = async (next: Exclude<TranscriptAction, null>) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setAction(next);
    setActionError(null);
    try {
      if (next === 'cancel') await api.cancelTranscript(runtime.scope.source, controller.signal);
      else await api.reprocessTranscript(runtime.scope.source, controller.signal);
      if (!controller.signal.aborted && controllerRef.current === controller) {
        await query.refetch();
      }
    } catch {
      if (!controller.signal.aborted && controllerRef.current === controller) {
        setActionError(
          next === 'cancel'
            ? 'Transcript preparation could not be cancelled.'
            : 'Transcript preparation could not be restarted.',
        );
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setAction(null);
      }
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
