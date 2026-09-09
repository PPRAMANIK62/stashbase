import { useMemo, type Ref, type RefCallback } from 'react';

function assignRef<T>(ref: Ref<T> | undefined, node: T | null): void {
  if (typeof ref === 'function') ref(node);
  else if (ref) ref.current = node;
}

/**
 * Fans one DOM node out to several refs — typically a component's own
 * measurement ref plus the ref its caller forwarded.
 *
 * The returned callback returns `undefined` rather than React 19's optional
 * cleanup function, so every ref it feeds is cleared the legacy way: React
 * calls the callback again with `null`.
 */
export function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  return (node) => {
    for (const ref of refs) assignRef(ref, node);
  };
}

/**
 * `mergeRefs` for the pair every forwarding component has — its own ref and
 * the caller's — with an identity that only changes when one of them does.
 *
 * It matters where a child's layout effects read the node: a fresh callback
 * ref makes React detach (call with `null`) and re-attach on every render,
 * and anything that runs in that window sees a null ref. Memoising closes the
 * window for the common case, where both refs are stable, while still
 * re-running the attachment when a ref really is swapped out.
 */
export function useMergedRef<T>(own: Ref<T> | undefined, forwarded: Ref<T> | undefined) {
  return useMemo(() => mergeRefs(own, forwarded), [own, forwarded]);
}
