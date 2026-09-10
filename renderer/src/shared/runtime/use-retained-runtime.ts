import { useEffect, useRef, useState } from 'react';

/**
 * One runtime for the life of the component, disposed once the last mount of
 * it is really gone.
 *
 * StrictMode mounts, unmounts and remounts a component with the same state, so
 * the naive `useEffect(() => () => runtime.dispose(), [runtime])` disposes a
 * runtime that the very next commit goes on using. Counting live mounts and
 * deferring the decision by a microtask lets the remount cancel the teardown,
 * while a genuine unmount still tears down before the next task runs.
 *
 * `dispose` is read fresh each render, so it need not be memoised.
 */
export function useRetainedRuntime<Runtime>(
  create: () => Runtime,
  dispose: (runtime: Runtime) => void,
): Runtime {
  const [runtime] = useState(create);
  const latestDispose = useRef(dispose);
  latestDispose.current = dispose;
  const mounts = useRef(0);

  useEffect(() => {
    mounts.current += 1;
    return () => {
      mounts.current -= 1;
      queueMicrotask(() => {
        if (mounts.current === 0) latestDispose.current(runtime);
      });
    };
  }, [runtime]);

  return runtime;
}
