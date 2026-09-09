import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

/** One request in flight: the cache key that identifies it and the call that
 *  answers it. A lane is built per keystroke and thrown away with it. */
export interface DebouncedLane<Data> {
  readonly fetch: (signal: AbortSignal) => Promise<Data>;
  readonly key: readonly unknown[];
}

export interface DebouncedQuerySpec<Data> {
  /** Cancelled whenever the lane changes, so an obsolete answer never lands. */
  readonly cancelKey: readonly unknown[];
  /** How long a keystroke waits before it reaches the transport. */
  readonly delayMs: number;
  /** The lane the caller wants next; null keeps the query idle. */
  readonly lane: DebouncedLane<Data> | null;
}

export interface DebouncedQueryResult<Data> {
  readonly data: Data | undefined;
  readonly error: Error | null;
  readonly isError: boolean;
  readonly isFetching: boolean;
  /** True while the caller's latest lane is still waiting out the debounce. */
  readonly isSettling: boolean;
  readonly isSuccess: boolean;
  readonly refetch: () => void;
  /** Skips the remaining delay and runs the pending lane now. */
  readonly submit: () => void;
}

/** Identity of a lane for comparison. The key is already the cache identity,
 *  so nothing else has to describe "the same request". */
function laneKey(lane: DebouncedLane<unknown> | null): string {
  return lane ? JSON.stringify(lane.key) : '';
}

/** Debounces one lane at a time and cancels whatever it replaces. The signal
 *  comes from React Query, so an abandoned request is aborted rather than
 *  left to land on a surface that has moved on. */
export function useDebouncedQuery<Data>({
  cancelKey,
  delayMs,
  lane,
}: DebouncedQuerySpec<Data>): DebouncedQueryResult<Data> {
  const queryClient = useQueryClient();
  const [settled, setSettled] = useState<DebouncedLane<Data> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(lane);
  pending.current = lane;
  const nextKey = laneKey(lane);
  const settledKey = laneKey(settled);

  const cancelTimer = useCallback(() => {
    if (timer.current !== null) {
      globalThis.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const settle = useCallback(
    (next: DebouncedLane<Data> | null) => {
      cancelTimer();
      void queryClient.cancelQueries({ queryKey: cancelKey });
      setSettled(next);
    },
    [cancelKey, cancelTimer, queryClient],
  );

  useEffect(() => {
    cancelTimer();
    void queryClient.cancelQueries({ queryKey: cancelKey });
    if (nextKey === '') {
      setSettled(null);
      return;
    }
    timer.current = globalThis.setTimeout(() => {
      timer.current = null;
      setSettled(pending.current);
    }, delayMs);
    return cancelTimer;
  }, [cancelKey, cancelTimer, delayMs, nextKey, queryClient]);

  useEffect(
    () => () => {
      cancelTimer();
      void queryClient.cancelQueries({ queryKey: cancelKey });
    },
    [cancelKey, cancelTimer, queryClient],
  );

  const query = useQuery({
    enabled: settled !== null,
    queryFn: ({ signal }) =>
      settled === null
        ? Promise.reject(new Error('No settled request to run.'))
        : settled.fetch(signal),
    queryKey: settled === null ? [...cancelKey, 'idle'] : settled.key,
    retry: false,
    staleTime: 0,
  });

  return {
    data: query.data,
    error: query.error,
    isError: query.isError,
    isFetching: query.isFetching,
    isSettling: nextKey !== '' && nextKey !== settledKey,
    isSuccess: query.isSuccess,
    refetch: () => void query.refetch(),
    submit: () => settle(pending.current),
  };
}
