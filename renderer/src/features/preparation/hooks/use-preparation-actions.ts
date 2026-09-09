import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  PreparationError,
  type PreparationControlApi,
  type PreparationReprocessOptions,
} from '@/features/preparation/application/ports';
import { folderStatusQueryKey } from '@/features/preparation/application/queries';
import type { SourceReference } from '@/shared/domain/source-reference';

export type PreparationAction = 'cancel' | 'reprocess';

/** Explicit preparation controls for one source. Every action refetches the
 *  folder status afterwards; nothing is shown optimistically. */
export function usePreparationActions(api: PreparationControlApi, source: SourceReference) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PreparationAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const prepareRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      prepareRef.current?.abort();
    },
    [],
  );

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: folderStatusQueryKey(source.folderPath) }),
    [queryClient, source.folderPath],
  );

  const run = useCallback(
    async (action: PreparationAction, options: PreparationReprocessOptions = {}) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setPending(action);
      setError(null);
      try {
        if (action === 'cancel') await api.cancel(source, controller.signal);
        else await api.reprocess(source, options, controller.signal);
        if (!controller.signal.aborted) await invalidate();
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(
          caught instanceof PreparationError && caught.kind === 'blocked'
            ? caught.message
            : action === 'cancel'
              ? 'Preparation could not be cancelled.'
              : 'Reprocess could not start. Try again.',
        );
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          setPending(null);
        }
      }
    },
    [api, invalidate, source],
  );

  const prepare = useCallback(() => {
    prepareRef.current?.abort();
    const controller = new AbortController();
    prepareRef.current = controller;
    void api
      .prepare(source, controller.signal)
      .then(() => {
        if (!controller.signal.aborted) return invalidate();
        return undefined;
      })
      .catch(() => {
        // Prepare-on-open is best effort: unsupported formats and transient
        // failures leave the next status poll to tell the truth.
      })
      .finally(() => {
        if (prepareRef.current === controller) prepareRef.current = null;
      });
  }, [api, invalidate, source]);

  return {
    cancel: () => run('cancel'),
    error,
    pending,
    prepare,
    reprocess: (options?: PreparationReprocessOptions) => run('reprocess', options),
  };
}
