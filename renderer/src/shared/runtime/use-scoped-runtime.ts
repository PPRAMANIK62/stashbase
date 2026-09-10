import { useRef, useState } from 'react';

import { useIsoLayoutEffect } from '@/lib/use-iso-layout-effect';

/**
 * Holds one runtime object per scope, and never hands back a stale one.
 *
 * A scoped runtime is created for a key (a folder, a folder plus a generation),
 * torn down when that key changes or the holder unmounts, and — critically —
 * must not be visible to renders that happen between the key changing and the
 * new runtime being committed. Reading a runtime built for the previous folder
 * is how a save lands in the wrong place.
 *
 * The key carries the whole identity of the scope: a null key means there is no
 * scope, and two different scopes must never produce the same string. `factory`
 * and `dispose` are read fresh on every call, so neither has to be memoised,
 * and neither takes part in deciding when the runtime is rebuilt.
 */
export function useScopedRuntime<Runtime>(
  key: string | null,
  factory: (key: string) => Runtime,
  dispose: (runtime: Runtime) => void,
): Runtime | null {
  const [held, setHeld] = useState<{ key: string; runtime: Runtime } | null>(null);
  const latest = useRef({ dispose, factory });
  latest.current = { dispose, factory };

  useIsoLayoutEffect(() => {
    if (key === null) {
      setHeld(null);
      return;
    }
    const runtime = latest.current.factory(key);
    setHeld({ key, runtime });
    return () => latest.current.dispose(runtime);
  }, [key]);

  return held !== null && held.key === key ? held.runtime : null;
}
