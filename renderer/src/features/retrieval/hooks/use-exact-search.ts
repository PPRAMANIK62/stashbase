import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ExactSearchApi } from '@/features/retrieval/application/ports';
import { exactSearchQuery, exactSearchQueryKeys } from '@/features/retrieval/application/queries';
import type { ExactSearchRequest } from '@/features/retrieval/domain/exact-search';

const searchDelayMs = 160;
const idleRequest: ExactSearchRequest = {
  caseSensitive: false,
  query: '',
  wholeWord: false,
};

function requestKey(request: ExactSearchRequest | null): string {
  return request
    ? `${request.folderPath ?? ''}\u0000${request.query}\u0000${request.caseSensitive}\u0000${request.wholeWord}`
    : '';
}

export function useExactSearch(api: ExactSearchApi, request: ExactSearchRequest | null) {
  const queryClient = useQueryClient();
  const [settledRequest, setSettledRequest] = useState<ExactSearchRequest | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRequest = useRef(request);
  currentRequest.current = request;
  const nextKey = requestKey(request);
  const settledKey = requestKey(settledRequest);

  const cancelTimer = useCallback(() => {
    if (timer.current !== null) {
      globalThis.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const settle = useCallback(
    (next: ExactSearchRequest | null) => {
      cancelTimer();
      void queryClient.cancelQueries({ queryKey: exactSearchQueryKeys.all });
      setSettledRequest(next);
    },
    [cancelTimer, queryClient],
  );

  useEffect(() => {
    cancelTimer();
    void queryClient.cancelQueries({ queryKey: exactSearchQueryKeys.all });
    if (!request) {
      setSettledRequest(null);
      return;
    }
    timer.current = globalThis.setTimeout(() => {
      timer.current = null;
      setSettledRequest(request);
    }, searchDelayMs);
    return cancelTimer;
  }, [cancelTimer, nextKey, queryClient, request]);

  useEffect(
    () => () => {
      cancelTimer();
      void queryClient.cancelQueries({ queryKey: exactSearchQueryKeys.all });
    },
    [cancelTimer, queryClient],
  );

  const queryOptions = useMemo(
    () => exactSearchQuery(api, settledRequest ?? idleRequest),
    [api, settledRequest],
  );
  const query = useQuery({ ...queryOptions, enabled: settledRequest !== null });

  return {
    ...query,
    isSettling: request !== null && nextKey !== settledKey,
    submit: () => settle(currentRequest.current),
  };
}
