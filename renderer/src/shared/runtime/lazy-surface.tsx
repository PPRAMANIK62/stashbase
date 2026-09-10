import { lazy, Suspense, useCallback, useState, type ComponentType, type ReactNode } from 'react';

export interface LazySurfaceOptions<Props> {
  /** Wraps the loaded surface so a failed chunk can be retried. It is handed
   *  the surface's own props, so a modal's recovery can offer the reader the
   *  same way out the modal would have. */
  boundary?: (retry: () => void, children: ReactNode, props: Props) => ReactNode;
  /** Shown while the chunk is in flight. Defaults to nothing. */
  fallback?: ReactNode;
  /** Skips the import entirely until this says the surface is wanted. */
  when?: (props: Props) => boolean;
}

/**
 * A code-split surface, as one call instead of one hand-written wrapper each.
 *
 * Every deferred surface in this app repeats the same three decisions: when the
 * chunk is worth fetching at all, what stands in its place while it loads, and
 * what happens when the fetch fails. Written by hand they drifted — one wrapper
 * gained a retry the others never got. Here they are named once, and the lazy
 * component is held in state so `retry` can replace it with a fresh one; a
 * module-level `lazy` caches its own rejection forever and can never recover.
 *
 * What `retry` cannot do is heal a chunk whose fetch failed. A fresh `lazy`
 * calls `load` again, but the browser keeps a module URL that failed to fetch
 * as errored in its own module map, so the same `import()` rejects again
 * without issuing a request. A retry therefore recovers a surface that loaded
 * and then threw while rendering, while a chunk that never arrived stays gone
 * for the life of the document.
 */
export function lazySurface<Props extends object>(
  load: () => Promise<{ default: ComponentType<Props> }>,
  { boundary, fallback = null, when }: LazySurfaceOptions<Props> = {},
): (props: Props) => ReactNode {
  return function LazySurface(props: Props) {
    const [Surface, setSurface] = useState(() => lazy(load));
    const retry = useCallback(() => setSurface(() => lazy(load)), []);
    if (when && !when(props)) return null;
    const content = (
      <Suspense fallback={fallback}>
        <Surface {...props} />
      </Suspense>
    );
    return boundary ? boundary(retry, content, props) : content;
  };
}
