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
 * gained a retry the others never got. Here they are named once.
 *
 * The lazy component is made ONCE per surface and replaced only by a retry. It
 * cannot be made in the component's own state initialiser: a surface that
 * unmounts and comes back — the sidebar's Chats panel is the pane that does —
 * would get a fresh `lazy` on every mount, and a fresh one suspends for a tick
 * even when the module is already in the browser's cache. The fallback would
 * paint again on a panel with nothing left to load, and on a pane that mounts
 * mid-animation it paints DURING the travel and swaps under the reader. Held
 * beside the component instead, a remount reads a lazy that has already
 * resolved and renders straight through. It cannot be a bare module constant
 * either: that one caches its own rejection forever and could never recover,
 * which is what `retry` replaces.
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
  // `lazy` does not call `load`: the import is still issued by the first
  // render, so a surface behind a closed `when` gate still fetches nothing.
  const held = { Surface: lazy(load) };
  return function LazySurface(props: Props) {
    // Both sides go through the functional form: a `lazy` is callable as far
    // as its type is concerned, so handing one to `useState` directly picks
    // the updater overload and infers the state as whatever it would return.
    const [Surface, setSurface] = useState(() => held.Surface);
    const retry = useCallback(() => {
      held.Surface = lazy(load);
      setSurface(() => held.Surface);
    }, []);
    if (when && !when(props)) return null;
    const content = (
      <Suspense fallback={fallback}>
        <Surface {...props} />
      </Suspense>
    );
    return boundary ? boundary(retry, content, props) : content;
  };
}
