import { useCallback, useEffect, useRef } from 'react';

/** Hands each mutation its own abortable lane. Starting a lane's next call
 *  aborts that lane's in-flight one, so a repeated click cannot leave two
 *  competing writes racing to land; unmounting aborts every lane.
 *
 *  Lanes are independent: installing an agent must not cancel an unrelated
 *  download that is already running. Pass a lane-name union for typo safety. */
export function useRequestSignals<Lane extends string = string>() {
  const lanes = useRef(new Map<Lane, AbortController>());

  useEffect(() => {
    const open = lanes.current;
    return () => {
      for (const controller of open.values()) controller.abort();
      open.clear();
    };
  }, []);

  return useCallback((lane: Lane): AbortSignal => {
    lanes.current.get(lane)?.abort();
    const controller = new AbortController();
    lanes.current.set(lane, controller);
    return controller.signal;
  }, []);
}
